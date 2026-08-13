import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { evaluateEmailDetails } from '../utils/securityValidation';

interface EmailValidationChecklistProps {
  email: string;
  isFocused?: boolean;
  className?: string;
}

export const EmailValidationChecklist: React.FC<EmailValidationChecklistProps> = ({
  email,
  isFocused = false,
  className = ''
}) => {
  const cleanEmail = email.trim();
  const details = evaluateEmailDetails(cleanEmail);
  const isInvalid = cleanEmail.length > 0 && !details.isValid;

  return (
    <AnimatePresence>
      {isInvalid && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className={`flex items-center gap-1.5 text-xs text-rose-500 dark:text-rose-400 font-medium px-1 ${className}`}>
            <AlertCircle size={14} className="shrink-0 text-rose-500 dark:text-rose-400" />
            <span>Enter a valid email address</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailValidationChecklist;
