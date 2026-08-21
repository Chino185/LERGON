import React, { useState, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  Building,
  Save,
  Check,
  Lock,
  KeyRound,
  AlertCircle,
  Globe,
  Coins,
  Search,
  X,
  ChevronDown,
  User,
  Sliders,
  Shield,
  Database,
  Trash2,
  Upload,
  Camera,
  UserPlus,
  Clock,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { BusinessConfig, Organization, OrganizationInvite } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { COUNTRIES_AND_CURRENCIES } from '../utils/countryData';
import { translate } from '../utils/translations';
import {
  validateEmail,
  validateUsername,
  validateBusinessName,
  sanitizeInput
} from '../utils/securityValidation';
import {
  updateUserPassword,
  uploadProfilePhoto,
  clearProfilePhoto,
  subscribeToActiveAttendantInvite
} from '../utils/authServices';


interface SettingsScreenProps {
  config: BusinessConfig;
  onUpdateConfig: (newConfig: BusinessConfig) => void;
  onResetSeedData: () => void;
  onWipeStorage: () => void;
  onClearTransactions?: () => void;
  userRole?: number;
  userUid?: string;
  currentOrgId?: string;
  organizations?: Organization[];
  onUpdateOrganizations?: (updatedOrgs: Organization[]) => void;
  onGenerateInvite?: () => Promise<{ code: string; expiresAt: string } | null>;
  settingsTabOverride?: 'profile' | 'system' | 'security' | null;
  onClearSettingsTabOverride?: () => void;
}

// Extract list of sorted unique world currencies from the master list
const UNIQUE_CURRENCIES = Array.from(new Map(
  COUNTRIES_AND_CURRENCIES.map(item => [item.currencyCode, {
    code: item.currencyCode,
    symbol: item.currencySymbol,
    name: `${item.currencyName} (${item.currencyCode})`
  }])
).values()).sort((a, b) => a.code.localeCompare(b.code));

const LANGUAGE_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: { en: "English", fr: "French", zh: "Chinese (Simplified)" },
  fr: { en: "Anglais", fr: "Français", zh: "Chinois (Simplifié)" },
  zh: { en: "英语", fr: "法语", zh: "简体中文" }
};

const COUNTRY_TRANSLATIONS: Record<string, Record<string, string>> = {
  fr: {
    "united kingdom": "Royaume-Uni",
    "united states": "États-Unis",
    "france": "France",
    "china": "Chine",
    "canada": "Canada",
    "germany": "Allemagne",
    "belgium": "Belgique",
    "switzerland": "Suisse",
    "spain": "Espagne",
    "italy": "Italie",
    "japan": "Japon",
    "australia": "Australie",
    "netherlands": "Pays-Bas",
    "india": "Inde",
    "brazil": "Brésil",
    "south africa": "Afrique du Sud",
    "afghanistan": "Afghanistan",
    "albania": "Albanie",
    "algeria": "Algérie",
    "andorra": "Andorre",
    "angola": "Angola",
    "argentina": "Argentine",
    "armenia": "Arménie",
    "austria": "Autriche",
    "azerbaijan": "Azerbaïdjan",
    "bahamas": "Bahamas",
    "bahrain": "Bahreïn",
    "bangladesh": "Bangladesh",
    "barbados": "Barbade",
    "belarus": "Biélorussie",
    "belize": "Belize",
    "benin": "Bénin",
    "bermuda": "Bermudes",
    "bhutan": "Bhoutan",
    "bolivia": "Bolivie",
    "bosnia and herzegovina": "Bosnie-Herzégovine",
    "botswana": "Botswana",
    "brunei": "Brunéi",
    "bulgaria": "Bulgarie",
    "burkina faso": "Burkina Faso",
    "burundi": "Burundi",
    "cambodia": "Cambodge",
    "cameroon": "Cameroun",
    "cape verde": "Cap-Vert",
    "central african republic": "République centrafricaine",
    "chad": "Tchad",
    "chile": "Chili",
    "colombia": "Colombie",
    "comoros": "Comores",
    "costa rica": "Costa Rica",
    "croatia": "Croatie",
    "cuba": "Cuba",
    "cyprus": "Chypre",
    "czech republic": "République tchèque",
    "democratic republic of the congo": "République démocratique du Congo",
    "denmark": "Danemark",
    "djibouti": "Djibouti",
    "dominican republic": "République dominicaine",
    "east timor": "Timor oriental",
    "ecuador": "Équateur",
    "egypt": "Égypte",
    "el salvador": "El Salvador",
    "equatorial guinea": "Guinée équatoriale",
    "eritrea": "Érythrée",
    "estonia": "Estonie",
    "eswatini": "Eswatini",
    "ethiopia": "Éthiopie",
    "fiji": "Fidji",
    "finland": "Finlande",
    "gabon": "Gabon",
    "gambia": "Gambie",
    "georgia": "Géorgie",
    "ghana": "Ghana",
    "greece": "Grèce",
    "grenada": "Grenade",
    "guatemala": "Guatemala",
    "guinea": "Guinée",
    "guinea-bissau": "Guinée-Bissau",
    "guyana": "Guyana",
    "haiti": "Haïti",
    "honduras": "Honduras",
    "hungary": "Hongrie",
    "iceland": "Islande",
    "indonesia": "Indonésie",
    "iran": "Iran",
    "iraq": "Irak",
    "ireland": "Irlande",
    "israel": "Israël",
    "jamaica": "Jamaïque",
    "jordan": "Jordanie",
    "kazakhstan": "Kazakhstan",
    "kenya": "Kenya",
    "kiribati": "Kiribati",
    "kuwait": "Koweït",
    "kyrgyzstan": "Kirghizistan",
    "laos": "Laos",
    "latvia": "Lettonie",
    "lebanon": "Liban",
    "lesotho": "Lesotho",
    "liberia": "Liberia",
    "libya": "Libye",
    "liechtenstein": "Liechtenstein",
    "lithuania": "Lituanie",
    "luxembourg": "Luxembourg",
    "madagascar": "Madagascar",
    "malawi": "Malawi",
    "malaysia": "Malaisie",
    "maldives": "Maldives",
    "mali": "Mali",
    "malta": "Malte",
    "marshall islands": "Îles Marshall",
    "mauritania": "Mauritanie",
    "mauritius": "Maurice",
    "mexico": "Mexique",
    "micronesia": "Micronésie",
    "moldova": "Moldavie",
    "monaco": "Monaco",
    "mongolia": "Mongolie",
    "montenegro": "Monténégro",
    "morocco": "Maroc",
    "mozambique": "Mozambique",
    "myanmar": "Myanmar",
    "namibia": "Namibie",
    "nauru": "Nauru",
    "nepal": "Népal",
    "new zealand": "Nouvelle-Zélande",
    "nicaragua": "Nicaragua",
    "niger": "Niger",
    "nigeria": "Nigeria",
    "north korea": "Corée du Nord",
    "north macedonia": "Macédoine du Nord",
    "norway": "Norvège",
    "oman": "Oman",
    "pakistan": "Pakistan",
    "palau": "Palaos",
    "palestine": "Palestine",
    "panama": "Panama",
    "papua new guinea": "Papouasie-Nouvelle-Guinée",
    "paraguay": "Paraguay",
    "peru": "Pérou",
    "philippines": "Philippines",
    "poland": "Pologne",
    "portugal": "Portugal",
    "qatar": "Qatar",
    "republic of the congo": "République du Congo",
    "romania": "Roumanie",
    "russia": "Russie",
    "rwanda": "Rwanda",
    "saint kitts and nevis": "Saint-Christophe-et-Niévès",
    "saint lucia": "Sainte-Lucie",
    "saint vincent and the grenadines": "Saint-Vincent-et-les-Grenadines",
    "samoa": "Samoa",
    "san marino": "Saint-Marin",
    "sao tome and principe": "Sao Tomé-et-Principe",
    "saudi arabia": "Arabie saoudite",
    "senegal": "Sénégal",
    "serbia": "Serbie",
    "secondary": "Secondaire",
    "seychelles": "Seychelles",
    "sierra leone": "Sierra Leone",
    "singapore": "Singapour",
    "slovakia": "Slovaquie",
    "slovenia": "Slovénie",
    "solomon islands": "Îles Salomon",
    "somalia": "Somalie",
    "south korea": "Corée du Sud",
    "south sudan": "Soudan du Sud",
    "sri lanka": "Sri Lanka",
    "sudan": "Soudan",
    "suriname": "Suriname",
    "sweden": "Suède",
    "syria": "Syrie",
    "taiwan": "Taïwan",
    "tajikistan": "Tadjikistan",
    "tanzania": "Tanzanie",
    "thailand": "Thaïlande",
    "togo": "Togo",
    "tonga": "Tonga",
    "trinidad and tobago": "Trinité-et-Tobago",
    "tunisia": "Tunisie",
    "turkey": "Turquie",
    "turkmenistan": "Turkménistan",
    "tuvalu": "Tuvalu",
    "uganda": "Ouganda",
    "ukraine": "Ukraine",
    "united arab emirates": "Émirats arabes unis",
    "uruguay": "Uruguay",
    "uzbekistan": "Ouzbékistan",
    "vanuatu": "Vanuatu",
    "vatican city": "Vatican",
    "venezuela": "Venezuela",
    "vietnam": "Viêt Nam",
    "yemen": "Yémen",
    "zambia": "Zambie",
    "zimbabwe": "Zimbabwe"
  },
  zh: {
    "united kingdom": "英国",
    "united states": "美国",
    "france": "法国",
    "china": "中国",
    "canada": "加拿大",
    "germany": "德国",
    "belgium": "比利时",
    "switzerland": "瑞士",
    "spain": "西班牙",
    "italy": "意大利",
    "japan": "日本",
    "australia": "澳大利亚",
    "netherlands": "荷兰",
    "india": "印度",
    "brazil": "巴西",
    "south africa": "南非",
    "afghanistan": "阿富汗",
    "albania": "阿尔巴尼亚",
    "algeria": "阿尔及利亚",
    "andorra": "安道尔",
    "angola": "安哥拉",
    "argentina": "阿根廷",
    "armenia": "亚美尼亚",
    "austria": "奥地利",
    "azerbaijan": "阿塞拜疆",
    "bahamas": "巴哈马",
    "bahrain": "巴林",
    "bangladesh": "孟加拉国",
    "barbados": "巴巴多斯",
    "belarus": "白俄罗斯",
    "belize": "伯利兹",
    "benin": "贝宁",
    "bermuda": "百慕大",
    "bhutan": "不丹",
    "bolivia": "玻利维亚",
    "bosnia and herzegovina": "波斯尼亚和黑塞哥维那",
    "botswana": "博茨瓦纳",
    "brunei": "文莱",
    "bulgaria": "保加利亚",
    "burkina faso": "布基纳法索",
    "burundi": "布隆迪",
    "cambodia": "柬埔寨",
    "cameroon": "喀麦隆",
    "cape verde": "佛得角",
    "central african republic": "中非共和国",
    "chad": "乍得",
    "chile": "智利",
    "colombia": "哥伦比亚",
    "comoros": "科摩罗",
    "costa rica": "哥斯达黎加",
    "croatia": "克罗地亚",
    "cuba": "古巴",
    "cyprus": "塞浦路斯",
    "czech republic": "捷克共和国",
    "democratic republic of the congo": "刚果民主共和国",
    "denmark": "丹麦",
    "djibouti": "吉布提",
    "dominican republic": "多米尼加共和国",
    "east timor": "东帝汶",
    "ecuador": "厄瓜多尔",
    "egypt": "埃及",
    "el salvador": "萨尔瓦多",
    "equatorial guinea": "赤道几内亚",
    "eritrea": "厄立特里亚",
    "estonia": "爱沙尼亚",
    "eswatini": "斯威士兰",
    "ethiopia": "埃塞俄比亚",
    "fiji": "斐济",
    "finland": "芬兰",
    "gabon": "加蓬",
    "gambia": "冈比亚",
    "georgia": "格鲁吉亚",
    "ghana": "加纳",
    "greece": "希腊",
    "grenada": "格林纳达",
    "guatemala": "危地马拉",
    "guinea": "几内亚",
    "guinea-bissau": "几内亚比绍",
    "guyana": "圭亚那",
    "haiti": "海地",
    "honduras": "洪都拉斯",
    "hungary": "匈牙利",
    "iceland": "冰岛",
    "indonesia": "印度尼西亚",
    "iran": "伊朗",
    "iraq": "伊拉克",
    "ireland": "爱尔兰",
    "israel": "以色列",
    "jamaica": "牙买加",
    "jordan": "约旦",
    "kazakhstan": "哈萨克斯坦",
    "kenya": "肯尼亚",
    "kiribati": "基里巴斯",
    "kuwait": "科威特",
    "kyrgyzstan": "吉尔吉斯斯坦",
    "laos": "老挝",
    "latvia": "拉脱维亚",
    "lebanon": "黎巴嫩",
    "lesotho": "莱索托",
    "liberia": "利比里亚",
    "libya": "利比亚",
    "liechtenstein": "列支敦士登",
    "lithuania": "立陶宛",
    "luxembourg": "卢森堡",
    "madagascar": "马达加斯加",
    "malawi": "马拉维",
    "malaysia": "马来西亚",
    "maldives": "马尔代夫",
    "mali": "马里",
    "malta": "马耳他",
    "marshall islands": "马绍尔群岛",
    "mauritania": "毛里塔尼亚",
    "mauritius": "毛里求斯",
    "mexico": "墨西哥",
    "micronesia": "密克罗尼西亚",
    "moldova": "摩尔多瓦",
    "monaco": "摩纳哥",
    "mongolia": "蒙古",
    "montenegro": "黑山",
    "morocco": "摩洛哥",
    "mozambique": "莫桑比克",
    "myanmar": "缅甸",
    "namibia": "纳米比亚",
    "nauru": "瑙鲁",
    "nepal": "尼泊尔",
    "new zealand": "新西兰",
    "nicaragua": "尼加拉瓜",
    "niger": "尼日尔",
    "nigeria": "尼日利亚",
    "north korea": "朝鲜",
    "north macedonia": "北马其顿",
    "norway": "挪威",
    "oman": "阿曼",
    "pakistan": "巴基斯坦",
    "palau": "帕劳",
    "palestine": "巴勒斯坦",
    "panama": "巴拿马",
    "papua new guinea": "巴布亚新几内亚",
    "paraguay": "巴拉圭",
    "peru": "秘鲁",
    "philippines": "菲律宾",
    "poland": "波兰",
    "portugal": "葡萄牙",
    "qatar": "卡塔尔",
    "republic of the congo": "刚果共和国",
    "romania": "罗马尼亚",
    "russia": "俄罗斯",
    "rwanda": "卢旺达",
    "saint kitts and nevis": "圣基茨和尼维斯",
    "saint lucia": "圣卢西亚",
    "saint vincent and the grenadines": "圣文森特和格林纳丁斯",
    "samoa": "萨摩亚",
    "san marino": "圣马力诺",
    "sao tome and principe": "圣多美和普林西比",
    "saudi arabia": "沙特阿拉伯",
    "senegal": "塞内加尔",
    "serbia": "塞尔维亚",
    "seychelles": "塞舌尔",
    "sierra leone": "塞拉利昂",
    "singapore": "新加坡",
    "slovakia": "斯洛伐克",
    "slovenia": "斯洛文尼亚",
    "solomon islands": "所罗门群岛",
    "somalia": "索马里",
    "south korea": "韩国",
    "south sudan": "南苏丹",
    "sri lanka": "斯里兰卡",
    "sudan": "苏丹",
    "suriname": "苏里南",
    "sweden": "瑞典",
    "syria": "叙利亚",
    "taiwan": "台湾",
    "tajikistan": "塔吉克斯坦",
    "tanzania": "坦桑尼亚",
    "thailand": "泰国",
    "togo": "多哥",
    "tonga": "汤加",
    "trinidad and tobago": "特立尼达和多巴哥",
    "tunisia": "突尼斯",
    "turkey": "土耳其",
    "turkmenistan": "土库曼斯坦",
    "tuvalu": "图瓦卢",
    "uganda": "乌干达",
    "ukraine": "乌克兰",
    "united arab emirates": "阿联酋",
    "uruguay": "乌拉圭",
    "uzbekistan": "乌兹别克斯坦",
    "vanuatu": "瓦努阿图",
    "vatican city": "梵蒂冈",
    "venezuela": "委内瑞拉",
    "vietnam": "越南",
    "yemen": "叶门",
    "zambia": "赞比亚",
    "zimbabwe": "津巴布韦"
  }
};

const getTranslatedCountry = (country: string, lang: string): string => {
  const cLower = (country || "").toLowerCase();
  const langKey = (lang || "en").startsWith("zh") ? "zh" : (lang || "en").toLowerCase();
  if (COUNTRY_TRANSLATIONS[langKey]?.[cLower]) {
    return COUNTRY_TRANSLATIONS[langKey][cLower];
  }
  return country;
};

const getTranslatedCurrencyName = (name: string, langCode: string): string => {
  const code = (langCode || "en").toLowerCase();
  const targetCode = code.startsWith("zh") ? "zh" : code;
  if (targetCode === "en") return name;

  let cleanName = name.split(' (')[0];

  if (targetCode === "fr") {
    const frMap: Record<string, string> = {
      "Euro": "Euro",
      "US Dollar": "Dollar américain",
      "British Pound": "Livre sterling",
      "Pound Sterling": "Livre sterling",
      "Canadian Dollar": "Dollar canadien",
      "Australian Dollar": "Dollar australien",
      "Japanese Yen": "Yen japonais",
      "Swiss Franc": "Franc suisse",
      "Chinese Yuan": "Yuan chinois",
      "New Zealand Dollar": "Dollar néo-zélandais",
      "Swedish Krona": "Couronne suédoise",
      "Norwegian Krone": "Couronne norvégienne",
      "Danish Krone": "Couronne danoise",
      "Indian Rupee": "Roupie indienne",
      "Hong Kong Dollar": "Dollar de Hong Kong",
      "Singapore Dollar": "Dollar de Singapour",
      "South Korean Won": "Won sud-coréen",
      "Russian Ruble": "Rouble russe",
      "Turkish Lira": "Lire turque",
      "South African Rand": "Rand sud-africain",
      "Brazilian Real": "Réal brésilien",
      "Mexican Peso": "Peso mexicain"
    };
    if (frMap[cleanName]) return frMap[cleanName];
    let result = cleanName
      .replace(/Dollar/g, "Dollar")
      .replace(/Pound/g, "Livre")
      .replace(/Franc/g, "Franc")
      .replace(/Peso/g, "Peso")
      .replace(/Ruble/g, "Rouble")
      .replace(/Rupee/g, "Roupie")
      .replace(/Krone/g, "Couronne")
      .replace(/Krona/g, "Couronne")
      .replace(/Won/g, "Won");
    return result;
  }

  if (targetCode === "zh") {
    const zhMap: Record<string, string> = {
      "Euro": "欧元",
      "US Dollar": "美元",
      "British Pound": "英镑",
      "Pound Sterling": "英镑",
      "Canadian Dollar": "加元",
      "Australian Dollar": "澳元",
      "Japanese Yen": "日元",
      "Swiss Franc": "瑞士法郎",
      "Chinese Yuan": "人民币",
      "New Zealand Dollar": "纽元",
      "Swedish Krona": "瑞典克朗",
      "Norwegian Krone": "挪威克朗",
      "Danish Krone": "丹麦克朗",
      "Indian Rupee": "印度卢比",
      "Hong Kong Dollar": "港币",
      "Singapore Dollar": "新加坡元",
      "South Korean Won": "韩元",
      "Russian Ruble": "俄罗斯卢布",
      "Turkish Lira": "土耳其里拉",
      "South African Rand": "南非兰特",
      "Brazilian Real": "巴西雷亚尔",
      "Mexican Peso": "墨西哥比索",
      "West African CFA franc": "西非法郎",
      "Central African CFA franc": "中非法郎"
    };
    if (zhMap[cleanName]) return zhMap[cleanName];
    return cleanName;
  }

  return cleanName;
};

export default function SettingsScreen({
  config,
  onUpdateConfig,
  onResetSeedData,
  onWipeStorage,
  onClearTransactions,
  userRole,
  userUid,
  currentOrgId,
  organizations,
  onUpdateOrganizations,
  onGenerateInvite,
  settingsTabOverride,
  onClearSettingsTabOverride
}: SettingsScreenProps) {
  const isAttendant = userRole === 5;

  // Navigation State
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'security'>('profile');

  // Sync tab with external navigation overrides (e.g. from notifications list click)
  React.useEffect(() => {
    if (settingsTabOverride) {
      const requestedTab = isAttendant && settingsTabOverride === 'system'
        ? 'profile'
        : settingsTabOverride;
      setActiveTab(requestedTab);
      if (onClearSettingsTabOverride) {
        onClearSettingsTabOverride();
      }
    }
  }, [settingsTabOverride, onClearSettingsTabOverride, isAttendant]);

  React.useEffect(() => {
    if (isAttendant && activeTab === 'system') {
      setActiveTab('profile');
    }
  }, [isAttendant, activeTab]);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentOrg = organizations?.find(o => o.id === currentOrgId);
  const initialUserName = isAttendant
    ? (currentOrg?.attendantName || '')
    : (currentOrg?.adminName || config.ownerName || 'Administrator');
  const initialUserPhoto = isAttendant
    ? (currentOrg?.attendantPhoto || '')
    : (currentOrg?.adminPhoto || config.profilePhoto || '');

  // Form states initialized with config values
  const [busName, setBusName] = useState(config.businessName);
  const [ownName, setOwnName] = useState(initialUserName);
  const [busPhone, setBusPhone] = useState(config.phone);
  const [busEmail, setBusEmail] = useState(config.email);

  React.useEffect(() => {
    if (config.email) {
      setBusEmail(config.email);
    }
    if (config.businessName) {
      setBusName(config.businessName);
    }
    if (typeof config.phone === 'string') {
      setBusPhone(config.phone);
    }
  }, [config.email, config.businessName, config.phone]);
  const [adminPhone, setAdminPhone] = useState(config.adminPhone || '');
  const [attendantPhone, setAttendantPhone] = useState(config.attendantPhone || '');
  const [currencyCode, setCurrencyCode] = useState(config.currency);
  const [currencySymbol, setCurrencySymbol] = useState(config.currencySymbol || '$');
  const [countryVal, setCountryVal] = useState(config.country || 'United States');
  const selectedDialCode = COUNTRIES_AND_CURRENCIES.find(c => c.country === countryVal)?.dialCode || '';
  const phoneInputValue = selectedDialCode && busPhone.trim().startsWith(selectedDialCode)
    ? busPhone.trim().slice(selectedDialCode.length).trim()
    : busPhone;
  const [profilePhoto, setProfilePhoto] = useState(initialUserPhoto);
  // Holds the raw File pending upload to Supabase Storage. profilePhoto
  // above is just the local preview (existing backend URL, or a blob
  // preview of a not-yet-uploaded file) shown in the <img>.
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Restore the persisted backend photo whenever App hydrates or updates it.
  // A pending local File remains the immediate preview until the save finishes.
  React.useEffect(() => {
    if (!profilePhotoFile) {
      setProfilePhoto(config.profilePhoto || '');
    }
  }, [config.profilePhoto, profilePhotoFile]);

  // Supabase Auth Password Update States
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess('');
    setPwdError('');
    setIsChangingPwd(true);

    const res = await updateUserPassword(currentPwd, newPwd);
    setIsChangingPwd(false);

    if (res.success) {
      setPwdSuccess('Your account password has been updated successfully.');
      setCurrentPwd('');
      setNewPwd('');
    } else {
      setPwdError(res.error || 'Failed to update password. Please verify your current password.');
    }
  };


  // Search & custom dropdown states
  const [countryQuery, setCountryQuery] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);

  const countryRef = React.useRef<HTMLDivElement>(null);
  const currencyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(event.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset/Wipe Confirm states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // --- Attendant Invite PIN Generator & Live Countdown ---
  // The Systems page owns a backend-backed copy so returning to this page,
  // refreshing, or reopening the tab cannot restore an old local timer.
  const [backendInviteLoaded, setBackendInviteLoaded] = useState(false);
  const [backendActiveInvite, setBackendActiveInvite] = useState<OrganizationInvite | null>(null);

  React.useEffect(() => {
    if (isAttendant || !currentOrgId) {
      setBackendInviteLoaded(false);
      setBackendActiveInvite(null);
      return;
    }

    setBackendInviteLoaded(false);
    const unsubscribe = subscribeToActiveAttendantInvite(currentOrgId, (invite) => {
      const nextInvite = invite
        ? {
          code: invite.code,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          isUsed: invite.isUsed
        }
        : null;
      setBackendActiveInvite(nextInvite);
      setBackendInviteLoaded(true);
      if (organizations && onUpdateOrganizations) {
        onUpdateOrganizations(organizations.map(org => (
          org.id === currentOrgId
            ? { ...org, activeInvite: nextInvite || undefined }
            : org
        )));
      }
    });

    return unsubscribe;
  }, [isAttendant, currentOrgId]);

  const currentActiveInvite = backendInviteLoaded
    ? backendActiveInvite || undefined
    : currentOrg?.activeInvite;
  const [inviteTimeLeftSec, setInviteTimeLeftSec] = useState<number>(() => {
    if (!currentActiveInvite || currentActiveInvite.isUsed) return 0;
    return Math.max(0, Math.floor((currentActiveInvite.expiresAt - Date.now()) / 1000));
  });

  React.useEffect(() => {
    if (!currentActiveInvite || currentActiveInvite.isUsed) {
      setInviteTimeLeftSec(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((currentActiveInvite.expiresAt - Date.now()) / 1000));
      setInviteTimeLeftSec(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentActiveInvite]);

  React.useEffect(() => {
    if (
      inviteTimeLeftSec > 0 ||
      !currentActiveInvite ||
      currentActiveInvite.isUsed ||
      !organizations ||
      !currentOrgId ||
      !onUpdateOrganizations
    ) {
      return;
    }

    onUpdateOrganizations(
      organizations.map(org => (
        org.id === currentOrgId
          ? { ...org, activeInvite: undefined }
          : org
      ))
    );
  }, [inviteTimeLeftSec, currentActiveInvite, organizations, currentOrgId, onUpdateOrganizations]);

  const handleGenerateInvite = async () => {
    if (onGenerateInvite) {
      const backendInvite = await onGenerateInvite();
      if (!backendInvite) return;
      const newInvite: OrganizationInvite = {
        code: backendInvite.code,
        createdAt: Date.now(),
        expiresAt: new Date(backendInvite.expiresAt).getTime(),
        isUsed: false
      };
      if (organizations && currentOrgId && onUpdateOrganizations) {
        onUpdateOrganizations(organizations.map(org => org.id === currentOrgId ? { ...org, activeInvite: newInvite } : org));
      }
      setBackendActiveInvite(newInvite);
      setBackendInviteLoaded(true);
      setInviteTimeLeftSec(Math.max(0, Math.floor((newInvite.expiresAt - Date.now()) / 1000)));
      return;
    }

    if (!organizations || !currentOrgId || !onUpdateOrganizations) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const newInvite: OrganizationInvite = { code, createdAt: now, expiresAt: now + 5 * 60 * 1000, isUsed: false };
    onUpdateOrganizations(organizations.map(org => org.id === currentOrgId ? { ...org, activeInvite: newInvite } : org));
    setInviteTimeLeftSec(300);
  };

  // Dynamically initialize status of link between default country and base currency config
  const getCountryDefaultCurrency = (countryName: string) => {
    const found = COUNTRIES_AND_CURRENCIES.find(c => c.country === countryName);
    return found ? found.currencyCode : null;
  };
  const isInitiallySynced = getCountryDefaultCurrency(config.country || 'United States') === config.currency &&
    COUNTRIES_AND_CURRENCIES.find(c => c.country === (config.country || 'United States'))?.currencySymbol === config.currencySymbol;
  const [syncWithCountry, setSyncWithCountry] = useState(isInitiallySynced);

  // Temporary Password States for resetting attendant passcode
  const [tempPasswordInput, setTempPasswordInput] = useState('');
  const [tempPasswordFeedback, setTempPasswordFeedback] = useState<string | null>(null);

  // Switch country callback - sets default currency & prefix code
  const handleCountrySelect = (countryName: string) => {
    const found = COUNTRIES_AND_CURRENCIES.find(c => c.country === countryName);
    if (found) {
      setCountryVal(found.country);

      // Auto-update base currency only if link is active
      if (syncWithCountry) {
        setCurrencyCode(found.currencyCode);
        setCurrencySymbol(found.currencySymbol);
      }

      // Auto-update dial prefix code for the phone callout
      let updatedPhone = busPhone.trim();
      const prefixRegex = /^\+\d+([- ]\d+)?/;
      if (prefixRegex.test(updatedPhone)) {
        updatedPhone = updatedPhone.replace(prefixRegex, found.dialCode);
      } else if (updatedPhone === '' || updatedPhone === 'undefined') {
        updatedPhone = found.dialCode + ' ';
      } else {
        // If it looks like a local phone without lead country code, prepend dial code
        updatedPhone = found.dialCode + ' ' + updatedPhone;
      }
      setBusPhone(updatedPhone);
    }
  };

  // Shrinks/re-encodes a profile photo client-side (max ~320px on the
  // longest side, JPEG @ 0.82 quality) before it's ever uploaded. This is
  // what keeps "Update Profile" fast -- a multi-MB camera photo becomes a
  // tiny file in milliseconds locally, instead of a slow upload over the
  // network. Falls back to the original file if anything goes wrong.
  const resizeImageFile = (file: File, maxDim = 320, quality = 0.82): Promise<File> => {
    return new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            const resized = new File(
              [blob],
              file.name.replace(/\.[^./\\]+$/, '') + '.jpg',
              { type: 'image/jpeg' }
            );
            resolve(resized);
          }, 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
        img.src = objectUrl;
      } catch {
        resolve(file);
      }
    });
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('File size must be under 3MB.');
      return;
    }
    setPhotoError('');
    setPhotoRemoved(false);

    // Downscale/compress client-side before we ever touch the network.
    // Phone camera photos can be several MB even under the 3MB cap, and
    // a profile picture never needs to render bigger than a couple
    // hundred pixels -- shrinking it here (canvas resize + JPEG
    // re-encode) typically takes it down to tens of KB, which is what
    // actually makes the upload (and therefore "Update Profile") fast.
    // If anything about the resize fails, we just fall back to the
    // original file so the feature still works.
    const uploadFile = await resizeImageFile(file);

    // Keep the (resized) File for upload on save, and show a local
    // preview immediately via a data URL (no backend round-trip needed
    // just to preview).
    setProfilePhotoFile(uploadFile);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhoto(reader.result);
      }
    };
    reader.readAsDataURL(uploadFile);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Filter lists based on user search queries (memoized to prevent re-render flickers)
  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES_AND_CURRENCIES;
    return COUNTRIES_AND_CURRENCIES.filter(c =>
      c.country.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.currencyCode.toLowerCase().includes(q)
    );
  }, [countryQuery]);

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    if (!q) return UNIQUE_CURRENCIES;
    return UNIQUE_CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  }, [currencyQuery]);

  // Submit profile & system settings edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const usernameCheck = validateUsername(ownName);
    if (!usernameCheck.isValid) {
      alert(usernameCheck.error || 'Username is invalid.');
      return;
    }
    const cleanUsername = usernameCheck.cleanUsername;

    setPhotoError('');
    setIsSavingProfile(true);

    // Resolve the profile photo against the backend first. Admin and
    // Attendant each own only their own photo (enforced by Storage RLS),
    // keyed off their own userUid -- never a colleague's.
    let resolvedPhotoUrl = profilePhoto;
    if (profilePhotoFile && userUid && currentOrgId) {
      const uploadRes = await uploadProfilePhoto(userUid, currentOrgId, profilePhotoFile);
      if (!uploadRes.success) {
        setIsSavingProfile(false);
        setPhotoError(uploadRes.error || 'Failed to upload profile photo.');
        return;
      }
      resolvedPhotoUrl = uploadRes.url || '';
    } else if (photoRemoved && userUid) {
      const clearRes = await clearProfilePhoto(userUid);
      if (!clearRes.success) {
        setIsSavingProfile(false);
        setPhotoError(clearRes.error || 'Failed to remove profile photo.');
        return;
      }
      resolvedPhotoUrl = '';
    }

    if (isAttendant) {
      // Attendants may only change their own name and photo here --
      // country and currency are Admin-only, org-wide settings, so they
      // are intentionally omitted from this payload and left untouched
      // (the ...config spread preserves the current values).
      onUpdateConfig({
        ...config,
        ownerName: cleanUsername,
        phone: sanitizeInput(busPhone),
        attendantPhone: sanitizeInput(busPhone),
        profilePhoto: resolvedPhotoUrl
      });

      if (organizations && currentOrgId && onUpdateOrganizations) {
        const updatedOrgs = organizations.map(org => {
          if (org.id === currentOrgId) {
            return {
              ...org,
              attendantName: cleanUsername,
              attendantPhoto: resolvedPhotoUrl
            };
          }
          return org;
        });
        onUpdateOrganizations(updatedOrgs);
      }
    } else {
      const busNameCheck = validateBusinessName(busName);
      if (!busNameCheck.isValid) {
        alert(busNameCheck.error || 'Business name is invalid.');
        setIsSavingProfile(false);
        return;
      }
      const cleanBusName = busNameCheck.cleanName;

      if (busEmail.trim()) {
        const emailCheck = validateEmail(busEmail);
        if (!emailCheck.isValid) {
          alert(emailCheck.error || 'Official Email address is invalid.');
          setIsSavingProfile(false);
          return;
        }
      }

      onUpdateConfig({
        businessName: cleanBusName,
        ownerName: cleanUsername,
        phone: sanitizeInput(busPhone),
        email: sanitizeInput(busEmail),
        address: config.address,
        currency: currencyCode,
        currencySymbol: currencySymbol,
        lowStockThresholdDefault: config.lowStockThresholdDefault,
        country: countryVal,
        language: 'English',
        languageCode: 'en',
        profilePhoto: resolvedPhotoUrl,
        adminPhone: sanitizeInput(busPhone),
        attendantPhone: config.attendantPhone || sanitizeInput(attendantPhone)
      });

      // Keep organization list name, adminName, and adminPhoto in sync if Admin updates organization / trade name
      if (organizations && currentOrgId && onUpdateOrganizations) {
        const updatedOrgs = organizations.map(org => {
          if (org.id === currentOrgId) {
            return {
              ...org,
              name: cleanBusName,
              adminName: cleanUsername,
              adminPhoto: resolvedPhotoUrl
            };
          }
          return org;
        });
        onUpdateOrganizations(updatedOrgs);
      }
    }

    setProfilePhoto(resolvedPhotoUrl);
    setProfilePhotoFile(null);
    setPhotoRemoved(false);
    setIsSavingProfile(false);
    setSaveSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div id="settings-screen" className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card p-5 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{translate('settings', config.languageCode)}</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Configure business profiles, system preferences, base country, system currencies, and security credentials.
        </p>
      </div>

      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="p-3.5 px-4 rounded-2xl text-xs font-extrabold flex items-center gap-3 neumorphic-card border border-white/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#181f2c]"
          >
            <div className="w-7 h-7 rounded-full neumorphic-circle shrink-0 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 bg-emerald-500/10">
              <Check size={16} className="stroke-[3]" />
            </div>
            <span className="tracking-wide">
              Configurations saved and updated globally!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split Submenu Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Submenu Sidebar Tabs */}
        <div className="md:col-span-1 finnova-card p-4 sm:p-5 space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition text-left cursor-pointer select-none ${activeTab === 'profile'
              ? 'neumorphic-btn bg-slate-200/90 text-slate-950 font-black border-2 border-slate-900 shadow-md'
              : 'neumorphic-btn text-slate-800 font-extrabold hover:text-black border border-white/80'
              }`}
          >
            <MaterialIcon name="person" size={18} className="text-slate-800" />
            <span>{translate('profileSettings', config.languageCode)}</span>
          </button>
          {!isAttendant && (
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition text-left cursor-pointer select-none ${activeTab === 'system'
                ? 'neumorphic-btn bg-slate-200/90 text-slate-950 font-black border-2 border-slate-900 shadow-md'
                : 'neumorphic-btn text-slate-800 font-extrabold hover:text-black border border-white/80'
                }`}
            >
              <MaterialIcon name="tune" size={18} className="text-slate-800" />
              <span>{translate('systemSettings', config.languageCode)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition text-left cursor-pointer select-none ${activeTab === 'security'
              ? 'neumorphic-btn bg-slate-200/90 text-slate-950 font-black border-2 border-slate-900 shadow-md'
              : 'neumorphic-btn text-slate-800 font-extrabold hover:text-black border border-white/80'
              }`}
          >
            <MaterialIcon name="security" size={18} className="text-slate-800" />
            <span>{translate('securitySettings', config.languageCode)}</span>
          </button>
        </div>

        {/* Tab Contents Pane */}
        <div className="md:col-span-3">
          {/* Active Tab Component */}
          {activeTab === 'profile' && (
            <div className="finnova-card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-850 border-b pb-2.5 flex items-center gap-1.5">
                <User size={16} className="text-indigo-550" />
                <span>{translate('profileSettings', config.languageCode)}</span>
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Profile Photo Uploader */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-2">
                    Profile Photo
                  </label>
                  {photoError && (
                    <div className="mb-2 flex items-center gap-2 text-red-600 font-bold">
                      <AlertCircle size={14} />
                      <span>{photoError}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-5 p-5 finnova-card">
                    {/* Circle Preview */}
                    <div className="relative group shrink-0 w-20 h-20 neumorphic-circle text-slate-900 flex items-center justify-center overflow-hidden border border-white/90">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile Preview"
                          className="w-full h-full object-cover animate-fade-in"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-1">
                          <MaterialIcon name="person" size={28} className="text-slate-800" />
                          <span className="text-[8px] text-slate-800 font-extrabold select-none">No Photo</span>
                        </div>
                      )}

                      {profilePhoto && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProfilePhoto('');
                            setProfilePhotoFile(null);
                            setPhotoRemoved(true);
                          }}
                          className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150 cursor-pointer text-white text-[10px] font-bold"
                          title="Remove Photo"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={`flex-1 w-full border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center transition cursor-pointer neumorphic-card ${isDragging
                        ? 'border-slate-800 bg-slate-200/60'
                        : 'border-slate-300 bg-[#ebf0f7]/60 hover:border-slate-800'
                        }`}
                      onClick={() => document.getElementById('profile-photo-input')?.click()}
                    >
                      <input
                        type="file"
                        id="profile-photo-input"
                        className="hidden"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                      />
                      <MaterialIcon name="photo_camera" size={24} className="text-slate-900 mb-1.5" />
                      <p className="font-extrabold text-slate-900 text-xs">
                        {isDragging ? "Drop image here..." : "Drag and drop here, or click to browse"}
                      </p>
                      <p className="text-[9.5px] text-slate-500 font-medium mt-1">
                        Supports JPG, PNG or WEBP (Max 3MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registered Trade Name */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {translate('registeredTradeName', config.languageCode)}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={userRole === 5}
                    value={busName}
                    onChange={(e) => setBusName(e.target.value)}
                    className={`w-full rounded-lg border p-2.5 font-medium ${userRole === 5
                      ? 'neumorphic-inset border-slate-200 bg-[#e2e8f0]/70 dark:bg-[#25272c] text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                      : 'neumorphic-inset border-white/80 dark:border-slate-700 bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500'
                      }`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Industrial legal name of your entity printed on bills and invoices. {userRole === 5 && <span className="text-amber-600 font-semibold">(Restricted to Admin)</span>}
                  </p>
                </div>

                {/* Username */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    {translate('username', config.languageCode)} (Operator Username)
                  </label>
                  <input
                    type="text"
                    required
                    value={ownName}
                    onChange={(e) => setOwnName(e.target.value)}
                    className="w-full rounded-lg neumorphic-inset border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    The active name printed as operator/administrator on reports and audit ledgers.
                  </p>
                </div>

                {/* Contacts block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      {translate('officialEmail', config.languageCode)}
                    </label>
                    <input
                      type="email"
                      required
                      disabled={userRole === 5}
                      value={busEmail}
                      onChange={(e) => setBusEmail(e.target.value)}
                      className={`w-full rounded-lg border p-2.5 font-medium ${userRole === 5
                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed select-none'
                        : 'border-gray-300 bg-white text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500'
                        }`}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Contact Number
                    </label>
                    <div className="flex items-center rounded-xl neumorphic-inset border border-white/80 dark:border-slate-700 bg-[#ebf0f7] dark:bg-[#202225] focus-within:ring-1 focus-within:ring-indigo-500 overflow-hidden">
                      <span className="px-3 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-200 bg-[#e2e8f0]/80 dark:bg-[#25272c] border-r border-slate-300/70 dark:border-slate-700 select-none">
                        {selectedDialCode || '+'}
                      </span>
                      <input
                        type="tel"
                        value={phoneInputValue}
                        onChange={(e) => {
                          const nationalNumber = e.target.value.replace(/[^0-9\s()-]/g, '');
                          setBusPhone(selectedDialCode ? `${selectedDialCode}${nationalNumber}` : nationalNumber);
                        }}
                        placeholder="Contact number"
                        className="min-w-0 flex-1 p-2.5 font-mono bg-transparent text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>



                {/* Submit button */}
                <div className="pt-3 border-t border-slate-200/60 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2.5 neumorphic-btn text-slate-900 font-extrabold px-6 py-2.5 rounded-full transition cursor-pointer border border-white/90 hover:text-black select-none disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <MaterialIcon name="save" size={18} className="text-slate-800" />
                    <span>{isSavingProfile ? 'Saving...' : 'Update Profile'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="finnova-card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-850 border-b pb-2.5 flex items-center gap-1.5">
                <Globe size={16} className="text-indigo-550" />
                <span>{translate('systemSettings', config.languageCode)}</span>
              </h3>

              {isAttendant && (
                <div className="flex items-center gap-2.5 p-3 px-4 rounded-2xl neumorphic-inset text-slate-700 dark:text-slate-300 text-[11px] font-extrabold">
                  <Lock size={14} className="shrink-0" />
                  <span>Base country and currency are managed by your Administrator and shown here read-only.</span>
                </div>
              )}

              <AnimatePresence>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="p-3.5 px-4 rounded-2xl text-xs font-extrabold flex items-center gap-3 neumorphic-card border border-white/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#181f2c]"
                  >
                    <div className="w-7 h-7 rounded-full neumorphic-circle shrink-0 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 bg-emerald-500/10">
                      <Check size={16} className="stroke-[3]" />
                    </div>
                    <span className="tracking-wide">
                      System settings saved successfully!
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Searchable dropdown lists representing Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Default Country Selector */}
                  <div className="relative" ref={countryRef}>
                    <label className="block font-extrabold text-slate-900 mb-1">
                      Default Country (Operation Country)
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        disabled={isAttendant}
                        onClick={() => {
                          setIsCountryDropdownOpen(!isCountryDropdownOpen);
                          setIsCurrencyDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between rounded-xl border border-white/80 dark:border-slate-800/80 p-2.5 neumorphic-inset text-slate-900 dark:text-slate-100 text-left cursor-pointer min-h-[42px] font-extrabold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MaterialIcon name="public" size={16} className="text-slate-800 dark:text-slate-300 shrink-0" />
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {countryVal ? `${getTranslatedCountry(countryVal, config.languageCode)} (${COUNTRIES_AND_CURRENCIES.find(c => c.country === countryVal)?.code || ''})` : 'Select Country'}
                          </span>
                        </div>
                        <ChevronDown size={14} className="text-slate-700 dark:text-slate-400 shrink-0" />
                      </button>

                      <AnimatePresence>
                        {isCountryDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute left-0 right-0 top-full z-30 mt-1.5 p-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#131924] text-slate-800 dark:text-slate-200 neumorphic-card border border-white/90 dark:border-slate-800/80 shadow-2xl text-xs flex flex-col overflow-hidden max-w-full space-y-1.5"
                          >
                            <div className="p-2 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center gap-2">
                              <Search size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                              <input
                                type="text"
                                placeholder="Search nation name, ISO, currency..."
                                value={countryQuery}
                                onChange={(e) => setCountryQuery(e.target.value)}
                                className="w-full text-slate-900 dark:text-slate-100 bg-[#ebf0f7] dark:bg-[#181f2c] p-2 focus:outline-hidden text-xs rounded-xl neumorphic-inset font-extrabold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                autoFocus
                              />
                              {countryQuery && (
                                <button
                                  type="button"
                                  onClick={() => setCountryQuery('')}
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 font-bold shrink-0"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1 p-1 scrollbar-thin dark:scrollbar-thumb-slate-700 bg-transparent">
                              {filteredCountries.length > 0 ? (
                                filteredCountries.map(c => (
                                  <button
                                    key={c.country}
                                    type="button"
                                    onClick={() => {
                                      handleCountrySelect(c.country);
                                      setCountryQuery('');
                                      setIsCountryDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-all duration-150 cursor-pointer rounded-xl font-extrabold text-xs ${countryVal === c.country
                                      ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-md'
                                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                                      }`}
                                  >
                                    <span className="truncate pr-2 font-bold">{getTranslatedCountry(c.country, config.languageCode)} ({c.code})</span>
                                    <span className={`text-[10px] neumorphic-inset rounded-lg px-2 py-0.5 shrink-0 font-extrabold ${countryVal === c.country ? 'bg-white/20 text-white border-0' : 'text-slate-600 dark:text-slate-400'
                                      }`}>
                                      {c.currencyCode} · {c.dialCode}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-center text-slate-400 dark:text-slate-500 font-medium">
                                  No country matched search query
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* System Base Currency Selector */}
                  <div className="relative" ref={currencyRef}>
                    <label className="block font-extrabold text-slate-900 mb-1">
                      {translate('systemBaseCurrency', config.languageCode)}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        disabled={isAttendant}
                        onClick={() => {
                          setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen);
                          setIsCountryDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between rounded-xl border border-white/80 dark:border-slate-800/80 p-2.5 neumorphic-inset text-slate-900 dark:text-slate-100 text-left cursor-pointer min-h-[42px] font-extrabold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MaterialIcon name="currency_exchange" size={16} className="text-slate-800 dark:text-slate-300 shrink-0" />
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 neumorphic-card px-2 py-0.5 text-[10px] rounded-md shadow-2xs border border-white/60 dark:border-slate-700/60">
                            {currencyCode}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            ({currencySymbol}) - {getTranslatedCurrencyName(UNIQUE_CURRENCIES.find(c => c.code === currencyCode)?.name || 'Custom Override', config.languageCode)}
                          </span>
                        </div>
                        <ChevronDown size={14} className="text-slate-700 dark:text-slate-400 shrink-0" />
                      </button>

                      <AnimatePresence>
                        {isCurrencyDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute left-0 right-0 top-full z-30 mt-1.5 p-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#131924] text-slate-800 dark:text-slate-200 neumorphic-card border border-white/90 dark:border-slate-800/80 shadow-2xl text-xs flex flex-col overflow-hidden max-w-full space-y-1.5"
                          >
                            <div className="p-2 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center gap-2">
                              <Search size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                              <input
                                type="text"
                                placeholder="Search currency code, name..."
                                value={currencyQuery}
                                onChange={(e) => setCurrencyQuery(e.target.value)}
                                className="w-full text-slate-900 dark:text-slate-100 bg-[#ebf0f7] dark:bg-[#181f2c] p-2 focus:outline-hidden text-xs rounded-xl neumorphic-inset font-extrabold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                autoFocus
                              />
                              {currencyQuery && (
                                <button
                                  type="button"
                                  onClick={() => setCurrencyQuery('')}
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 font-bold shrink-0"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1 p-1 scrollbar-thin dark:scrollbar-thumb-slate-700 bg-transparent">
                              {filteredCurrencies.length > 0 ? (
                                filteredCurrencies.map(c => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      setCurrencyCode(c.code);
                                      setCurrencySymbol(c.symbol);
                                      setSyncWithCountry(false);
                                      setCurrencyQuery('');
                                      setIsCurrencyDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-all duration-150 cursor-pointer rounded-xl font-extrabold text-xs ${currencyCode === c.code
                                      ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-md'
                                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                                      }`}
                                  >
                                    <span className="truncate pr-2 font-bold">
                                      {getTranslatedCurrencyName(c.name, config.languageCode)}
                                    </span>
                                    <span className={`font-extrabold neumorphic-inset rounded-lg px-2 py-0.5 text-[10px] shrink-0 ${currencyCode === c.code ? 'bg-white/20 text-white border-0' : 'text-slate-700 dark:text-slate-300'
                                      }`}>
                                      {c.symbol}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-center text-slate-400 dark:text-slate-500 font-medium">
                                  No currencies matched search query
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Sync control checkbox and individual custom overrides */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2.5 px-1">
                    <input
                      id="sync-with-country-toggle"
                      type="checkbox"
                      checked={syncWithCountry}
                      disabled={isAttendant}
                      className="neumorphic-checkbox disabled:opacity-60 disabled:cursor-not-allowed"
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSyncWithCountry(checked);
                        if (checked) {
                          const found = COUNTRIES_AND_CURRENCIES.find(c => c.country === countryVal);
                          if (found) {
                            setCurrencyCode(found.currencyCode);
                            setCurrencySymbol(found.currencySymbol);
                          }
                        }
                      }}
                    />
                    <label htmlFor="sync-with-country-toggle" className="text-slate-900 select-none font-extrabold cursor-pointer text-[11px]">
                      Auto-link active base currency to selected Default Country changes
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 finnova-card p-5">
                    <div>
                      <label className="block font-extrabold text-slate-900 mb-1 font-mono">
                        Active Currency Code *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isAttendant}
                        value={currencyCode}
                        onChange={(e) => {
                          setCurrencyCode(e.target.value.toUpperCase());
                          setSyncWithCountry(false);
                        }}
                        placeholder="e.g. USD, EUR, BTC, COIN"
                        className="w-full rounded-xl border border-white/80 p-2.5 neumorphic-inset text-slate-900 font-mono font-extrabold tracking-wider focus:outline-hidden text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block font-extrabold text-slate-900 mb-1 font-mono">
                        Active Currency Symbol *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isAttendant}
                        value={currencySymbol}
                        onChange={(e) => {
                          setCurrencySymbol(e.target.value);
                          setSyncWithCountry(false);
                        }}
                        placeholder="e.g. $, €, ₿, ¤"
                        className="w-full rounded-xl border border-white/80 p-2.5 neumorphic-inset text-slate-900 font-extrabold focus:outline-hidden text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>



                {/* Submit save button -- Admin only; Attendants have no
                    editable fields on this tab, so no button is shown. */}
                {!isAttendant && (
                  <div className="pt-3 border-t border-slate-200/60 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex items-center gap-2.5 neumorphic-btn text-slate-900 font-extrabold px-6 py-2.5 rounded-full transition cursor-pointer border border-white/90 hover:text-black select-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <MaterialIcon name="save" size={18} className="text-slate-800" />
                      <span>{isSavingProfile ? 'Saving...' : 'Save System Settings'}</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Add Attendant Section (Admin Only) */}
              {!isAttendant && (
                <div className="mt-8 pt-6 border-t border-slate-200/60 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus size={16} className="text-sky-600 dark:text-sky-400" />
                        <span>Add Attendant</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                        Generate a one time code to invite a staff member. Code expires in 5 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="finnova-card p-5 rounded-2xl space-y-4 border border-white/80 dark:border-slate-800">
                    {!currentActiveInvite || currentActiveInvite.isUsed ? (
                      <button
                        type="button"
                        onClick={handleGenerateInvite}
                        className="flex items-center gap-2 neumorphic-btn bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer active:scale-95 shadow-md text-xs select-none"
                      >
                        <KeyRound size={16} />
                        <span>Generate Invite PIN</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl neumorphic-inset bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center gap-4">
                            <div className={`text-2xl font-black tracking-widest font-mono ${inviteTimeLeftSec > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-600 line-through'}`}>
                              {currentActiveInvite.code}
                            </div>

                            {inviteTimeLeftSec > 0 ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                <Clock size={14} className="animate-spin" />
                                <span>
                                  {Math.floor(inviteTimeLeftSec / 60)}:{(inviteTimeLeftSec % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-rose-500 dark:text-rose-400">
                                This code has expired. Generate a new one.
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleGenerateInvite}
                            className="flex items-center gap-1.5 neumorphic-btn text-slate-900 dark:text-white font-extrabold px-3.5 py-1.5 rounded-xl transition cursor-pointer text-xs border border-white/80 dark:border-slate-700 hover:text-sky-600 select-none"
                          >
                            <RefreshCw size={14} />
                            <span>Regenerate</span>
                          </button>
                        </div>

                        {inviteTimeLeftSec > 0 && (
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <CheckCircle size={14} className="text-emerald-500" />
                            <span>Share this code with your attendant now.</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}



            </div>
          )}

          {activeTab === 'security' && (
            <div className="finnova-card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-850 border-b pb-2.5 flex items-center gap-1.5">
                <Lock size={16} className="text-indigo-550" />
                <span>Security Settings</span>
              </h3>

              {/* Attendant Forgot Password Reset Prompt */}
              {userRole === 2 && currentOrg?.attendantResetRequested && currentOrg?.attendantPass?.startsWith('__RESETTING_') && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 neumorphic-card bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl text-xs space-y-3 mb-4 text-slate-800 dark:text-amber-100"
                >
                  <div className="flex items-start gap-2 text-amber-950 font-semibold">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-950 font-bold">Attendant Passcode Reset Request</p>
                      <p className="text-[11px] text-amber-800 font-normal mt-0.5">
                        Your attendant <strong className="font-semibold text-amber-950">"{currentOrg.attendantResetUsername || 'Attendant'}"</strong> has requested a password reset. They submitted the following email address to receive their temporary PIN:
                      </p>
                      <p className="text-[11px] font-mono text-amber-950 bg-amber-100/60 px-2 py-1 rounded mt-1.5 inline-block border border-amber-200">
                        {currentOrg.attendantResetEmail}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-amber-900 font-semibold">
                          Status:{' '}
                          {currentOrg.attendantPass.startsWith('__RESETTING_') ? (
                            <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200">Awaiting PIN Configuration</span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-500/20">
                              Temporary PIN Set: <code className="font-mono font-bold text-emerald-800">{currentOrg.attendantPass}</code>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/50 flex flex-col gap-2">
                    <label className="block font-semibold text-amber-900">
                      Set Temporary Passcode PIN
                    </label>
                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        value={tempPasswordInput}
                        onChange={(e) => {
                          setTempPasswordInput(e.target.value);
                          setTempPasswordFeedback(null);
                        }}
                        placeholder="e.g. 5566 or temp99"
                        className="flex-1 rounded-xl neumorphic-inset border border-amber-300/80 dark:border-amber-800 p-2 bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Generate a random 4-digit PIN
                          const rand = Math.floor(1000 + Math.random() * 9000).toString();
                          setTempPasswordInput(rand);
                          setTempPasswordFeedback(null);
                        }}
                        className="px-3 py-2 neumorphic-btn bg-amber-100/70 dark:bg-amber-950/30 hover:bg-amber-200/70 text-amber-900 dark:text-amber-100 font-semibold rounded-xl text-xs transition border border-amber-300/80 dark:border-amber-800 cursor-pointer"
                      >
                        Generate PIN
                      </button>
                    </div>

                    {tempPasswordFeedback && (
                      <p className="text-[11px] font-semibold text-emerald-700">
                        {tempPasswordFeedback}
                      </p>
                    )}

                    <div className="flex justify-end mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempPasswordInput.trim()) {
                            alert('Please specify a temporary passcode PIN.');
                            return;
                          }

                          if (organizations && currentOrgId && onUpdateOrganizations) {
                            const updated = organizations.map(o => {
                              if (o.id === currentOrgId) {
                                return {
                                  ...o,
                                  attendantPass: tempPasswordInput.trim(),
                                  isTempPassword: true,
                                  attendantResetRequested: true // keep active so verification modal and timer remain active
                                };
                              }
                              return o;
                            });
                            onUpdateOrganizations(updated);
                            setTempPasswordFeedback(`Passcode updated to "${tempPasswordInput.trim()}"! A secure simulated email with the temporary passcode PIN has been sent to ${currentOrg.attendantResetEmail}.`);
                            setTempPasswordInput('');
                          }
                        }}
                        className="flex items-center gap-1 neumorphic-btn bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl transition text-xs cursor-pointer"
                      >
                        <Check size={13} /> Set & Send Temporary Passcode
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Security & Password Management -- backed directly by
                  Supabase Auth (updateUserPassword re-authenticates with
                  the current password, then updates it). This is the only
                  password-change form in Settings; the old local pin/lock
                  code form (system tab) has been removed. */}
              <div className="space-y-4 text-left">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Security & Password Management</span>
                </h4>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  Update your account password to keep your account secure.
                </p>
                <form onSubmit={handlePasswordChangeSubmit} className="finnova-card p-5 rounded-2xl space-y-3 border border-white/80 dark:border-slate-800 max-w-lg">
                  {pwdSuccess && <div className="text-xs font-bold text-emerald-600 p-2 bg-emerald-50 rounded-lg">{pwdSuccess}</div>}
                  {pwdError && <div className="text-xs font-bold text-rose-600 p-2 bg-rose-50 rounded-lg">{pwdError}</div>}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="w-full rounded-xl neumorphic-inset border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white text-xs font-mono"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      className="w-full rounded-xl neumorphic-inset border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white text-xs font-mono"
                      placeholder="Enter new password (min 6 characters)"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isChangingPwd}
                    className="px-5 py-2.5 neumorphic-btn bg-slate-900 hover:bg-black text-white font-extrabold rounded-xl text-xs transition cursor-pointer"
                  >
                    {isChangingPwd ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}