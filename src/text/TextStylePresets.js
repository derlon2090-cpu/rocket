export const TEXT_STYLE_PRESETS = [
  {
    id: 'creator',
    name: 'صانع محتوى',
    sample: 'عنوان قوي',
    style: { color: '#ffffff', fontWeight: 900, outline: '2px #101820', shadow: '0 4px 18px #000c', background: 'transparent', padding: '0', radius: 0, fontSize: 58 },
  },
  {
    id: 'highlight',
    name: 'إبراز',
    sample: 'لفت الانتباه',
    style: { color: '#101820', fontWeight: 900, outline: '0px transparent', shadow: '0 2px 8px #0006', background: '#ffe36e', padding: '.16em .42em', radius: 12, fontSize: 52 },
  },
  {
    id: 'cinema',
    name: 'سينمائي',
    sample: 'عنوان أنيق',
    style: { color: '#fff4d6', fontWeight: 700, outline: '0px transparent', shadow: '0 3px 16px #000e', background: 'transparent', padding: '0', radius: 0, fontSize: 54 },
  },
  {
    id: 'label',
    name: 'بطاقة',
    sample: 'معلومة مهمة',
    style: { color: '#f5f8ff', fontWeight: 800, outline: '0px transparent', shadow: '0 2px 10px #0008', background: '#17243ddd', padding: '.22em .55em', radius: 14, fontSize: 48 },
  },
  {
    id: 'outline',
    name: 'حد خارجي',
    sample: 'أبيض واضح',
    style: { color: '#ffffff', fontWeight: 900, outline: '3px #07111c', shadow: '0 4px 12px #000d', background: 'transparent', padding: '0', radius: 0, fontSize: 56 },
  },
  {
    id: 'minimal',
    name: 'بسيط',
    sample: 'نص هادئ',
    style: { color: '#ffffff', fontWeight: 600, outline: '0px transparent', shadow: '0 2px 8px #000c', background: 'transparent', padding: '0', radius: 0, fontSize: 46 },
  },
];

export const DEFAULT_TEXT_STYLE = {
  preset: 'creator',
  ...TEXT_STYLE_PRESETS[0].style,
  align: 'center',
  position: 'lower',
};

export function getTextPreset(id) {
  return TEXT_STYLE_PRESETS.find((preset) => preset.id === id) || TEXT_STYLE_PRESETS[0];
}

export function getTextLayerStyle(design = {}) {
  const position = design.position || 'lower';
  return {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: position === 'upper' ? '12%' : position === 'middle' ? '50%' : 'auto',
    bottom: position === 'lower' ? '14%' : 'auto',
    transform: position === 'middle' ? 'translateY(-50%)' : 'none',
    textAlign: design.align || 'center',
    fontFamily: design.fontFamily || 'Thmanyah Sans,Thmanyah,Arial,Tahoma,sans-serif',
    fontSize: `${(Number(design.fontSize) || 54) / 10.8}cqw`,
    fontWeight: Number(design.fontWeight) || 800,
    lineHeight: 1.25,
    color: design.color || '#ffffff',
    WebkitTextStroke: design.outline || '0px transparent',
    textShadow: design.shadow || '0 3px 12px #000',
    background: design.background || 'transparent',
    padding: design.padding || '0',
    borderRadius: `${Number(design.radius) || 0}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  };
}
