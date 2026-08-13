import React from 'react';
import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { evaluatePasswordStrength, PasswordStrengthDetails } from '../utils/securityValidation';

interface PasswordValidationChecklistProps {
  password: string;
  className?: string;
  isFocused?: boolean;
  showWhenEmpty?: boolean;
}

export const PasswordValidationChecklist: React.FC<PasswordValidationChecklistProps> = ({
  password,
  className = '',
  isFocused = false,
  showWhenEmpty = false
}) => {
  // Show only if user has typed something or focused the password field
  const shouldShow = showWhenEmpty || isFocused || (password && password.length > 0);

  const strength: PasswordStrengthDetails = evaluatePasswordStrength(password);

  const items = [
    { label: 'At least 8 characters long', isMet: strength.hasMinLength },
    { label: 'One uppercase letter (A-Z)', isMet: strength.hasUppercase },
    { label: 'One lowercase letter (a-z)', isMet: strength.hasLowercase },
    { label: 'One number (0-9)', isMet: strength.hasNumber },
    { label: 'One special character (!@#$%^&* etc)', isMet: strength.hasSpecialChar }
  ];

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className={`p-3.5 rounded-xl neumorphic-inset text-[11px] space-y-2 border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-[#121417] ${className}`}>
            <p className="font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[9px] mb-1">
              PASSWORD REQUIREMENTS CHECKLIST
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div 
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-in-out ${
                      item.isMet 
                        ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/50 shadow-sm' 
                        : 'bg-slate-200 dark:bg-[#1e2228] text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700/80'
                    }`}
                  >
                    {item.isMet ? (
                      <Check size={10} className="stroke-[3] animate-fadeIn" />
                    ) : (
                      <X size={10} className="stroke-[2.5]" />
                    )}
                  </div>
                  <span 
                    className={`font-semibold text-[11px] transition-colors duration-200 ease-in-out ${
                      item.isMet 
                        ? 'text-slate-900 dark:text-slate-100 font-extrabold' 
                        : 'text-slate-500 dark:text-slate-400 font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasswordValidationChecklist;
