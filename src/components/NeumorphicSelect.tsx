import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface NeumorphicSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface NeumorphicSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NeumorphicSelectOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export const NeumorphicSelect: React.FC<NeumorphicSelectProps> = ({
  value,
  onChange,
  options,
  icon,
  placeholder = 'Select option...',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative min-w-[180px] ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 rounded-full neumorphic-inset focus:outline-hidden cursor-pointer transition select-none"
      >
        <div className="flex items-center gap-2.5 truncate">
          {icon && <span className="text-slate-400 dark:text-slate-400 shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 dark:text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''}`}
        />
      </button>

      {/* Custom 3D Neumorphic Floating Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full z-50 p-1.5 rounded-2xl border border-white/90 dark:border-slate-800/80 shadow-2xl overflow-hidden max-h-64 overflow-y-auto scrollbar-thin bg-[#ebf0f7] dark:bg-[#131924] text-slate-800 dark:text-slate-200"
            style={{
              boxShadow: '8px 8px 24px rgba(0, 0, 0, 0.4), -4px -4px 16px rgba(255, 255, 255, 0.05)'
            }}
          >
            <div className="space-y-1">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-md'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && (
                        <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          {opt.icon}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && <Check size={14} className="shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NeumorphicSelect;
