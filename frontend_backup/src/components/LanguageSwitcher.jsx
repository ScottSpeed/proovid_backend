import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <div className="language-switcher">
      <button 
        onClick={toggleLanguage}
        className="language-toggle-btn"
        title={i18n.language === 'de' ? t('switchToEnglish') : t('switchToGerman')}
      >
        <span className="language-flag">
          {i18n.language === 'de' ? '🇩🇪' : '🇺🇸'}
        </span>
        <span className="language-text">
          {i18n.language === 'de' ? 'DE' : 'EN'}
        </span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;