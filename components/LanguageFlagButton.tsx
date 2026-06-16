import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLanguage } from '../constants/LanguageContext';
import { languageOptions, Language } from '../constants/i18n';
import Icon from './Icon';

export default function LanguageFlagButton() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = languageOptions.find(option => option.id === language) || languageOptions[0];

  const selectLanguage = (next: Language) => {
    setLanguage(next);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(prev => !prev)} activeOpacity={0.82}>
        <Text style={styles.flag}>{current.flag}</Text>
        <Text style={styles.short}>{current.shortLabel}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.menu}>
          {languageOptions.map(option => {
            const selected = option.id === language;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.option}
                onPress={() => selectLanguage(option.id)}
                activeOpacity={0.78}
              >
                <Text style={styles.optionFlag}>{option.flag}</Text>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {selected ? <Icon name="check" size={16} color="#E53935" /> : <View style={styles.checkSpace} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 34,
    right: 20,
    zIndex: 20,
    alignItems: 'flex-end',
  },
  button: {
    minWidth: 68,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  flag: { fontSize: 19 },
  short: { color: '#373737', fontSize: 12, fontWeight: '900' },
  menu: {
    width: 176,
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  option: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  optionFlag: { fontSize: 18 },
  optionLabel: { flex: 1, color: '#373737', fontSize: 14, fontWeight: '800' },
  checkSpace: { width: 16, height: 16 },
});
