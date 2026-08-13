-- ============================================================================
-- SUPABASE POSTGRESQL DATABASE MIGRATION SCRIPT
-- Application: AI Business Partner (Velo IC)
-- Migration: Firebase Firestore/Auth to Supabase Postgres/Auth
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================================

create type user_role as enum ('admin', 'attendant');
create type account_status as enum ('active', 'suspended', 'pending');
create type theme_preference as enum ('light', 'dark');
create type restock_status as enum ('pending', 'on_hold', 'approved', 'rejected');
create type transaction_type as enum ('sell', 'credit', 'repayment', 'restock', 'damage', 'supplier_payment');
create type credit_profile_type as enum ('customer_receivable', 'supplier_payable');
create type credit_profile_status as enum ('active', 'partially_paid', 'settled');
create type activity_source as enum ('manual', 'ai_assistant');
create type notification_category as enum ('inventory', 'credit', 'system');

-- ============================================================================
-- 2. TABLES & CONSTRAINTS
-- ============================================================================

-- 2.1 BUSINESSES TABLE
create table public.businesses (
    id uuid primary key default gen_random_uuid(),
    trade_name text not null,
    base_country text not null default 'United States',
    base_currency_code text not null default 'USD',
    base_currency_symbol text not null default '$',
    owner_admin_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 2.2 PROFILES TABLE (1-to-1 with auth.users)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    role user_role not null default 'attendant',
    business_id uuid references public.businesses(id) on delete cascade,
    display_username text,
    profile_photo_url text,
    theme_preference theme_preference not null default 'light',
    account_status account_status not null default 'active',
    created_at timestamptz not null default now(),
    last_login timestamptz
);

-- 2.3 INVENTORY ITEMS TABLE
create table public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    product_title text not null,
    sku text not null,
    category text not null default 'General',
    quantity_in_hand integer not null default 0 constraint chk_qty_non_negative check (quantity_in_hand >= 0),
    low_stock_guard_level integer not null default 5 constraint chk_guard_level_non_negative check (low_stock_guard_level >= 0),
    cost_price numeric(12,2) not null default 0.00 constraint chk_cost_non_negative check (cost_price >= 0),
    selling_price numeric(12,2) not null default 0.00 constraint chk_price_non_negative check (selling_price >= 0),
    supplier_name text,
    shelf_location text,
    internal_notes text,
    image_url text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_business_sku unique (business_id, sku)
);

-- 2.4 DAMAGE REPORTS TABLE
create table public.damage_reports (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    item_id uuid not null references public.inventory_items(id) on delete cascade,
    quantity_damaged integer not null constraint chk_damaged_pos check (quantity_damaged > 0),
    justification_text text not null,
    cost_price_at_time numeric(12,2) not null default 0.00,
    selling_price_at_time numeric(12,2) not null default 0.00,
    sunk_cost_loss numeric(12,2) not null default 0.00,
    potential_retail_loss numeric(12,2) not null default 0.00,
    reported_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 2.5 RESTOCK REQUESTS TABLE
create table public.restock_requests (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    item_id uuid not null references public.inventory_items(id) on delete cascade,
    attendant_qty integer not null constraint chk_attendant_qty_pos check (attendant_qty > 0),
    submitted_by uuid references public.profiles(id) on delete set null,
    status restock_status not null default 'pending',
    admin_input_qty integer,
    discrepancy_notes text,
    resolved_at timestamptz,
    resolved_qty integer,
    created_at timestamptz not null default now()
);

-- 2.6 TRANSACTIONS TABLE (Append-Only)
create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    type transaction_type not null,
    total_amount numeric(12,2) not null constraint chk_total_amount_non_neg check (total_amount >= 0),
    items jsonb not null default '[]'::jsonb,
    payment_method text,
    performed_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 2.7 CREDIT PROFILES TABLE
create table public.credit_profiles (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    type credit_profile_type not null,
    contact_name text not null,
    contact_phone text,
    contact_email text,
    initial_amount numeric(12,2) not null default 0.00 constraint chk_init_amt_non_neg check (initial_amount >= 0),
    remaining_balance numeric(12,2) not null default 0.00 constraint chk_rem_bal_non_neg check (remaining_balance >= 0),
    status credit_profile_status not null default 'active',
    receipt_url text,
    due_date date,
    notes text,
    created_at timestamptz not null default now(),
    last_payment_at timestamptz
);

-- 2.8 ACTIVITY LOGS TABLE (Append-Only)
create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    action text not null,
    details text not null,
    performed_by uuid references public.profiles(id) on delete set null,
    source activity_source not null default 'manual',
    created_at timestamptz not null default now()
);

-- 2.9 NOTIFICATIONS TABLE
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    category notification_category not null,
    message text not null,
    related_ref text,
    created_at timestamptz not null default now()
);

-- 2.10 NOTIFICATION READS TABLE (Per-User Read State)
create table public.notification_reads (
    notification_id uuid not null references public.notifications(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    read_at timestamptz not null default now(),
    primary key (notification_id, profile_id)
);

-- 2.11 INVOICES TABLE
create table public.invoices (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    invoice_number text not null,
    bill_to text not null,
    line_items jsonb not null default '[]'::jsonb,
    grand_total numeric(12,2) not null default 0.00,
    generated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 2.12 INVITE CODES TABLE
create table public.invite_codes (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    code text not null unique,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used boolean not null default false,
    used_by uuid references public.profiles(id) on delete set null
);

-- ============================================================================
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Helper: Get business_id of current authenticated user
create or replace function public.get_user_business_id()
returns uuid
language sql stable security definer
as $$
    select business_id from public.profiles where id = auth.uid();
$$;

-- Helper: Get user role of current authenticated user
create or replace function public.get_user_role()
returns user_role
language sql stable security definer
as $$
    select role from public.profiles where id = auth.uid();
$$;

-- Trigger: Automatically update remaining_balance / status on credit_profiles
create or replace function public.fn_credit_profile_auto_settle()
returns trigger
language plpgsql
as $$
begin
    if NEW.remaining_balance <= 0 then
        NEW.status := 'settled';
    elsif NEW.remaining_balance < NEW.initial_amount then
        NEW.status := 'partially_paid';
    else
        NEW.status := 'active';
    end if;
    return NEW;
end;
$$;

create trigger trg_credit_profile_auto_settle
before insert or update on public.credit_profiles
for each row
execute function public.fn_credit_profile_auto_settle();

-- Trigger: Automatically create profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
    insert into public.profiles (id, email, role, display_username)
    values (
        NEW.id,
        NEW.email,
        coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'admin'),
        coalesce(NEW.raw_user_meta_data->>'display_username', split_part(NEW.email, '@', 1))
    );
    return NEW;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- 4. ATOMIC DATABASE RPC PROCEDURES
-- ============================================================================

-- 4.1 RECORD SALE (Decrements stock, records transaction, logs activity)
create or replace function public.record_sale(
    p_business_id uuid,
    p_item_id uuid,
    p_quantity integer,
    p_unit_price numeric,
    p_payment_method text,
    p_performed_by uuid,
    p_source activity_source default 'manual'
)
returns uuid
language plpgsql security definer
as $$
declare
    v_item_title text;
    v_curr_qty integer;
    v_total_amount numeric(12,2);
    v_txn_id uuid;
begin
    select product_title, quantity_in_hand into v_item_title, v_curr_qty
    from public.inventory_items
    where id = p_item_id and business_id = p_business_id
    for update;

    if not found then
        raise exception 'Inventory item not found.';
    end if;

    if v_curr_qty < p_quantity then
        raise exception 'Insufficient stock. Available: %, Requested: %', v_curr_qty, p_quantity;
    end if;

    v_total_amount := p_quantity * p_unit_price;

    -- 1. Decrement inventory
    update public.inventory_items
    set quantity_in_hand = quantity_in_hand - p_quantity,
        updated_at = now()
    where id = p_item_id;

    -- 2. Insert transaction
    insert into public.transactions (business_id, type, total_amount, items, payment_method, performed_by)
    values (
        p_business_id,
        'sell',
        v_total_amount,
        jsonb_build_array(jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'unit_price', p_unit_price)),
        p_payment_method,
        p_performed_by
    )
    returning id into v_txn_id;

    -- 3. Log activity
    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'RECORD_SALE',
        format('Sold %s x %s @ %s (%s total)', p_quantity, v_item_title, p_unit_price, v_total_amount),
        p_performed_by,
        p_source
    );

    return v_txn_id;
end;
$$;

-- 4.2 RECORD CREDIT PROFILE
create or replace function public.record_credit(
    p_business_id uuid,
    p_type credit_profile_type,
    p_contact_name text,
    p_contact_phone text,
    p_contact_email text,
    p_amount numeric,
    p_due_date date,
    p_notes text,
    p_performed_by uuid,
    p_source activity_source default 'manual'
)
returns uuid
language plpgsql security definer
as $$
declare
    v_credit_id uuid;
begin
    insert into public.credit_profiles (
        business_id, type, contact_name, contact_phone, contact_email, initial_amount, remaining_balance, due_date, notes
    ) values (
        p_business_id, p_type, p_contact_name, p_contact_phone, p_contact_email, p_amount, p_amount, p_due_date, p_notes
    )
    returning id into v_credit_id;

    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'CREATE_CREDIT',
        format('Created %s credit for %s (Amount: %s)', p_type, p_contact_name, p_amount),
        p_performed_by,
        p_source
    );

    return v_credit_id;
end;
$$;

-- 4.3 RECORD REPAYMENT
create or replace function public.record_repayment(
    p_business_id uuid,
    p_credit_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_notes text,
    p_performed_by uuid,
    p_source activity_source default 'manual'
)
returns uuid
language plpgsql security definer
as $$
declare
    v_contact_name text;
    v_rem_bal numeric;
    v_txn_id uuid;
begin
    select contact_name, remaining_balance into v_contact_name, v_rem_bal
    from public.credit_profiles
    where id = p_credit_id and business_id = p_business_id
    for update;

    if not found then
        raise exception 'Credit profile not found.';
    end if;

    -- Update remaining balance
    update public.credit_profiles
    set remaining_balance = greatest(0, remaining_balance - p_amount),
        last_payment_at = now()
    where id = p_credit_id;

    -- Write transaction
    insert into public.transactions (business_id, type, total_amount, items, payment_method, performed_by)
    values (
        p_business_id,
        'repayment',
        p_amount,
        jsonb_build_array(jsonb_build_object('credit_id', p_credit_id, 'notes', p_notes)),
        p_payment_method,
        p_performed_by
    )
    returning id into v_txn_id;

    -- Log activity
    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'RECORD_REPAYMENT',
        format('Recorded repayment of %s for credit account %s', p_amount, v_contact_name),
        p_performed_by,
        p_source
    );

    return v_txn_id;
end;
$$;

-- 4.4 DIRECT ADMIN RESTOCK
create or replace function public.direct_admin_restock(
    p_business_id uuid,
    p_item_id uuid,
    p_quantity integer,
    p_notes text,
    p_performed_by uuid,
    p_source activity_source default 'manual'
)
returns boolean
language plpgsql security definer
as $$
declare
    v_item_title text;
begin
    select product_title into v_item_title
    from public.inventory_items
    where id = p_item_id and business_id = p_business_id
    for update;

    if not found then
        raise exception 'Item not found.';
    end if;

    update public.inventory_items
    set quantity_in_hand = quantity_in_hand + p_quantity,
        updated_at = now()
    where id = p_item_id;

    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'DIRECT_RESTOCK',
        format('Directly restocked %s units for %s. Notes: %s', p_quantity, v_item_title, coalesce(p_notes, 'N/A')),
        p_performed_by,
        p_source
    );

    return true;
end;
$$;

-- 4.5 SUBMIT RESTOCK REQUEST
create or replace function public.submit_restock_request(
    p_business_id uuid,
    p_item_id uuid,
    p_quantity integer,
    p_notes text,
    p_submitted_by uuid,
    p_source activity_source default 'manual'
)
returns uuid
language plpgsql security definer
as $$
declare
    v_req_id uuid;
    v_item_title text;
begin
    select product_title into v_item_title
    from public.inventory_items
    where id = p_item_id and business_id = p_business_id;

    insert into public.restock_requests (business_id, item_id, attendant_qty, submitted_by, status, discrepancy_notes)
    values (p_business_id, p_item_id, p_quantity, p_submitted_by, 'pending', p_notes)
    returning id into v_req_id;

    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'SUBMIT_RESTOCK_REQUEST',
        format('Submitted restock request for %s units of %s', p_quantity, v_item_title),
        p_submitted_by,
        p_source
    );

    return v_req_id;
end;
$$;

-- 4.6 VERIFY RESTOCK REQUEST
create or replace function public.verify_restock_request(
    p_business_id uuid,
    p_request_id uuid,
    p_item_id uuid,
    p_admin_qty integer,
    p_status restock_status,
    p_discrepancy_notes text,
    p_performed_by uuid,
    p_source activity_source default 'manual'
)
returns boolean
language plpgsql security definer
as $$
declare
    v_item_title text;
begin
    select product_title into v_item_title
    from public.inventory_items
    where id = p_item_id and business_id = p_business_id
    for update;

    update public.restock_requests
    set status = p_status,
        admin_input_qty = p_admin_qty,
        discrepancy_notes = p_discrepancy_notes,
        resolved_at = now(),
        resolved_qty = case when p_status = 'approved' then p_admin_qty else null end
    where id = p_request_id and business_id = p_business_id;

    if p_status = 'approved' then
        update public.inventory_items
        set quantity_in_hand = quantity_in_hand + p_admin_qty,
            updated_at = now()
        where id = p_item_id;
    end if;

    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'VERIFY_RESTOCK_REQUEST',
        format('Verified restock request for %s. Status: %s, Approved Qty: %s', v_item_title, p_status, p_admin_qty),
        p_performed_by,
        p_source
    );

    return true;
end;
$$;

-- 4.7 REPORT DAMAGED STOCK
create or replace function public.report_damaged_stock(
    p_business_id uuid,
    p_item_id uuid,
    p_quantity integer,
    p_justification text,
    p_reported_by uuid,
    p_source activity_source default 'manual'
)
returns uuid
language plpgsql security definer
as $$
declare
    v_item_title text;
    v_curr_qty integer;
    v_cost numeric(12,2);
    v_sell numeric(12,2);
    v_sunk numeric(12,2);
    v_potential numeric(12,2);
    v_report_id uuid;
begin
    select product_title, quantity_in_hand, cost_price, selling_price
    into v_item_title, v_curr_qty, v_cost, v_sell
    from public.inventory_items
    where id = p_item_id and business_id = p_business_id
    for update;

    if not found then
        raise exception 'Item not found.';
    end if;

    if v_curr_qty < p_quantity then
        raise exception 'Cannot report damaged quantity exceeding stock in hand (% available)', v_curr_qty;
    end if;

    v_sunk := p_quantity * v_cost;
    v_potential := p_quantity * v_sell;

    -- Decrement stock
    update public.inventory_items
    set quantity_in_hand = quantity_in_hand - p_quantity,
        updated_at = now()
    where id = p_item_id;

    -- Log damage report
    insert into public.damage_reports (
        business_id, item_id, quantity_damaged, justification_text,
        cost_price_at_time, selling_price_at_time, sunk_cost_loss, potential_retail_loss, reported_by
    ) values (
        p_business_id, p_item_id, p_quantity, p_justification,
        v_cost, v_sell, v_sunk, v_potential, p_reported_by
    ) returning id into v_report_id;

    -- Log activity
    insert into public.activity_logs (business_id, action, details, performed_by, source)
    values (
        p_business_id,
        'REPORT_DAMAGED_STOCK',
        format('Reported %s damaged units of %s. Reason: %s', p_quantity, v_item_title, p_justification),
        p_reported_by,
        p_source
    );

    return v_report_id;
end;
$$;

-- 4.8 JOIN ATTENDANT WITH INVITE CODE
create or replace function public.join_attendant_with_invite_code(
    p_invite_code text,
    p_user_id uuid,
    p_email text,
    p_display_username text
)
returns uuid
language plpgsql security definer
as $$
declare
    v_biz_id uuid;
    v_code_id uuid;
begin
    select id, business_id into v_code_id, v_biz_id
    from public.invite_codes
    where code = trim(p_invite_code)
      and used = false
      and expires_at > now();

    if not found then
        raise exception 'Invalid, expired, or already used invite code.';
    end if;

    -- Update user profile
    insert into public.profiles (id, email, role, business_id, display_username, account_status)
    values (p_user_id, p_email, 'attendant', v_biz_id, p_display_username, 'active')
    on conflict (id) do update set
        role = 'attendant',
        business_id = v_biz_id,
        display_username = p_display_username,
        account_status = 'active';

    -- Mark invite code as used
    update public.invite_codes
    set used = true,
        used_by = p_user_id
    where id = v_code_id;

    return v_biz_id;
end;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.damage_reports enable row level security;
alter table public.restock_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.credit_profiles enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.invoices enable row level security;
alter table public.invite_codes enable row level security;

-- 5.1 BUSINESSES POLICIES
create policy "Users can read own business" on public.businesses
    for select using (id = public.get_user_business_id());

create policy "Admins can update own business" on public.businesses
    for update using (id = public.get_user_business_id() and public.get_user_role() = 'admin');

-- 5.2 PROFILES POLICIES
create policy "Users can read profiles in same business" on public.profiles
    for select using (business_id = public.get_user_business_id() or id = auth.uid());

create policy "Users can update own profile" on public.profiles
    for update using (id = auth.uid());

-- 5.3 INVENTORY ITEMS POLICIES
create policy "Users can read business inventory" on public.inventory_items
    for select using (business_id = public.get_user_business_id());

create policy "Admins can insert inventory items" on public.inventory_items
    for insert with check (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

create policy "Admins can update inventory items" on public.inventory_items
    for update using (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

create policy "Admins can delete inventory items" on public.inventory_items
    for delete using (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

-- 5.4 DAMAGE REPORTS POLICIES
create policy "Users can read damage reports" on public.damage_reports
    for select using (business_id = public.get_user_business_id());

create policy "Admins can insert damage reports" on public.damage_reports
    for insert with check (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

-- 5.5 RESTOCK REQUESTS POLICIES
create policy "Users can read restock requests" on public.restock_requests
    for select using (business_id = public.get_user_business_id());

create policy "Attendants and Admins can insert pending restock requests" on public.restock_requests
    for insert with check (business_id = public.get_user_business_id() and status = 'pending');

create policy "Admins can update restock requests" on public.restock_requests
    for update using (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

-- 5.6 TRANSACTIONS POLICIES (Append-Only)
create policy "Users can read transactions" on public.transactions
    for select using (business_id = public.get_user_business_id());

create policy "Users can insert transactions" on public.transactions
    for insert with check (business_id = public.get_user_business_id());
-- (No UPDATE or DELETE policy -> Append-only)

-- 5.7 CREDIT PROFILES POLICIES
create policy "Admins can select all credits; Attendants select customer receivables" on public.credit_profiles
    for select using (
        business_id = public.get_user_business_id() and (
            public.get_user_role() = 'admin' or type = 'customer_receivable'
        )
    );

create policy "Admins can insert all credits; Attendants insert customer receivables" on public.credit_profiles
    for insert with check (
        business_id = public.get_user_business_id() and (
            public.get_user_role() = 'admin' or type = 'customer_receivable'
        )
    );

create policy "Admins can update all credits; Attendants update customer receivables" on public.credit_profiles
    for update using (
        business_id = public.get_user_business_id() and (
            public.get_user_role() = 'admin' or type = 'customer_receivable'
        )
    );

-- 5.8 ACTIVITY LOGS POLICIES (Append-Only)
create policy "Users can read activity logs" on public.activity_logs
    for select using (business_id = public.get_user_business_id());

create policy "Users can insert activity logs" on public.activity_logs
    for insert with check (business_id = public.get_user_business_id());
-- (No UPDATE or DELETE policy -> Append-only)

-- 5.9 NOTIFICATIONS & READS POLICIES
create policy "Users can read notifications" on public.notifications
    for select using (business_id = public.get_user_business_id());

create policy "Users can insert/delete own notification reads" on public.notification_reads
    for all using (profile_id = auth.uid());

-- 5.10 INVOICES POLICIES
create policy "Users can read invoices" on public.invoices
    for select using (business_id = public.get_user_business_id());

create policy "Users can insert invoices" on public.invoices
    for insert with check (business_id = public.get_user_business_id());

-- 5.11 INVITE CODES POLICIES
create policy "Admins can read/manage invite codes" on public.invite_codes
    for all using (business_id = public.get_user_business_id() and public.get_user_role() = 'admin');

-- ============================================================================
-- 6. STORAGE BUCKET POLICIES
-- ============================================================================

-- Create Storage Buckets if they don't exist
insert into storage.buckets (id, name, public) values
    ('receipts', 'receipts', false),
    ('inventory-images', 'inventory-images', true),
    ('business-logos', 'business-logos', true),
    ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Receipts Bucket Policies
create policy "Users can read receipts for their business" on storage.objects
    for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (public.get_user_business_id())::text);

create policy "Users can upload receipts for their business" on storage.objects
    for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (public.get_user_business_id())::text);

-- Inventory Images Policies
create policy "Users can read inventory images" on storage.objects
    for select using (bucket_id = 'inventory-images');

create policy "Admins can upload inventory images" on storage.objects
    for insert with check (bucket_id = 'inventory-images' and (storage.foldername(name))[1] = (public.get_user_business_id())::text and public.get_user_role() = 'admin');

-- Business Logos & Profile Photos Policies
create policy "Users can read logos & photos" on storage.objects
    for select using (bucket_id in ('business-logos', 'profile-photos'));

create policy "Users can upload logos & photos for their business" on storage.objects
    for insert with check (bucket_id in ('business-logos', 'profile-photos') and (storage.foldername(name))[1] = (public.get_user_business_id())::text);

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================
