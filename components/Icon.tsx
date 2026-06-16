import React from 'react';
import * as OutlineIcons from 'react-native-heroicons/outline';
import * as SolidIcons from 'react-native-heroicons/solid';

export type IconVariant = 'outline' | 'solid';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
  variant?: IconVariant;
  style?: any;
}

export default function Icon({ name, size = 22, color = '#f5f4f2', stroke = 2.5, variant = 'solid', style }: IconProps) {
  const IconComponent = getIconComponent(name, variant);
  
  if (!IconComponent) {
    const Fallback = variant === 'solid' ? SolidIcons.QuestionMarkCircleIcon : OutlineIcons.QuestionMarkCircleIcon;
    return <Fallback size={size} color={color} strokeWidth={variant === 'outline' ? stroke : undefined} style={style} />;
  }

  return <IconComponent size={size} color={color} strokeWidth={variant === 'outline' ? stroke : undefined} style={style} />;
}

function getIconComponent(name: string, variant: IconVariant) {
  const Icons = variant === 'solid' ? SolidIcons : OutlineIcons;
  switch (name) {
    case 'gear': return Icons.Cog6ToothIcon;
    case 'flame': return Icons.FireIcon;
    case 'bell': return Icons.BellIcon;
    case 'droplet': return Icons.BeakerIcon;
    case 'bed': return Icons.MoonIcon;
    case 'door': return Icons.ArrowRightOnRectangleIcon;
    case 'sunrise': return Icons.SunIcon;
    case 'camera': return Icons.CameraIcon;
    case 'flip': return Icons.ArrowsRightLeftIcon;
    case 'check': return Icons.CheckIcon;
    case 'chevR': return Icons.ChevronRightIcon;
    case 'chevL': return Icons.ChevronLeftIcon;
    case 'moon': return Icons.MoonIcon;
    case 'clock': return Icons.ClockIcon;
    case 'volume': return Icons.SpeakerWaveIcon;
    case 'sparkle': return Icons.SparklesIcon;
    case 'shield': return Icons.ShieldCheckIcon;
    case 'bolt': return Icons.BoltIcon;
    case 'user': return Icons.UserIcon;
    case 'arrowR': return Icons.ArrowRightIcon;
    case 'arrowUp': return Icons.ArrowUpIcon;
    case 'info': return Icons.InformationCircleIcon;
    case 'lock': return Icons.LockClosedIcon;
    case 'x': return Icons.XMarkIcon;
    case 'trash': return Icons.TrashIcon;
    case 'plus': return Icons.PlusIcon;
    case 'repeat': return Icons.ArrowPathIcon;
    case 'calendar': return Icons.CalendarIcon;
    case 'chevDown': return Icons.ChevronDownIcon;
    // New icons that were missing paths
    case 'layers': return Icons.Square3Stack3DIcon;
    case 'search': return Icons.MagnifyingGlassIcon;
    case 'play': return Icons.PlayIcon;
    case 'square': return Icons.StopIcon;
    case 'eye': return Icons.EyeIcon;
    case 'eyeOff': return Icons.EyeSlashIcon;
    case 'mail': return Icons.EnvelopeIcon;
    case 'globe': return Icons.GlobeAltIcon;
    case 'heart': return Icons.HeartIcon;
    case 'fileText': return Icons.DocumentTextIcon;
    case 'edit': return Icons.PencilIcon;
    case 'apple': return Icons.DevicePhoneMobileIcon;
    case 'arrowL': return Icons.ArrowLeftIcon;
    case 'camera': return Icons.CameraIcon;
    case 'barcode': return Icons.QrCodeIcon;
    case 'smartphone': return Icons.DevicePhoneMobileIcon;
    case 'hash': return Icons.CalculatorIcon;
    default: return Icons.StarIcon;
  }
}
