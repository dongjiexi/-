import {MathfieldElement} from './vendor/mathlive/mathlive.min.mjs';

MathfieldElement.fontsDirectory = './vendor/mathlive/fonts';
MathfieldElement.soundsDirectory = null;

let activeTarget = null;
let activeField = null;
let syncing = false;
let fieldEditing = false;
let visualEditing = false;
document.addEventListener('focusin',event=>{
  if(event.target===activeField)visualEditing=true;
  else if(event.target.matches?.('input,textarea')){
    visualEditing=false;
    const panel=document.getElementById('mathKeyboard');
    if(panel&&!panel.hidden&&!panel.contains(event.target)&&event.target!==activeTarget)connect(panel,event.target);
  }
});

document.addEventListener('input', event => {
  if (syncing || event.target !== activeTarget || !activeField) return;
  syncing = true;
  try { activeField.setValue(window.DongMathInput?.toTex(activeTarget.value) || activeTarget.value || '', {silenceNotifications: true}); }
  finally { syncing = false; }
});

function targetSupportsFormulaEditor(target) {
  return target?.isConnected && target.matches?.('input[type="text"],input:not([type])') && !target.disabled && !target.readOnly;
}

function targetName(target) {
  return target?.getAttribute('aria-label') || target?.closest('label')?.firstChild?.textContent?.trim() || '公式参数';
}

function connect(panel, target) {
  const host = panel?.querySelector('[data-mathlive-host]');
  if (!host) return;
  if (!targetSupportsFormulaEditor(target)) {
    activeTarget = null;
    host.innerHTML = '<p class="mathlive-note">题干可继续使用下方中文兼容键盘；选中方程或参数输入格，可启用完整 LaTeX 公式编辑器。</p>';
    return;
  }
  activeTarget = target;
  visualEditing = false;
  let configureField = false;
  if (!activeField) {
    activeField = new MathfieldElement();
    activeField.id = 'mathLiveField';
    activeField.setAttribute('aria-label', '完整 LaTeX 公式编辑器');
    configureField = true;
    activeField.addEventListener('beforeinput', () => { if (!syncing) fieldEditing = true; });
    activeField.addEventListener('input', () => {
      if (syncing || !fieldEditing || !targetSupportsFormulaEditor(activeTarget)) return;
      fieldEditing = false;
      syncing = true;
      activeTarget.value = activeField.value;
      activeTarget.dispatchEvent(new Event('input', {bubbles: true}));
      syncing = false;
    });
  }
  host.replaceChildren();
  const label = document.createElement('label');
  label.className = 'mathlive-label';
  label.textContent = `完整公式编辑器 · ${targetName(target)}`;
  const help = document.createElement('span');
  help.className = 'mathlive-note';
  help.textContent = '支持分式、根式、上下标、函数、集合、希腊字母与矩阵；内容实时写回原输入格。';
  const openKeyboard = document.createElement('button');
  openKeyboard.type = 'button';
  openKeyboard.className = 'mathlive-open-keyboard';
  openKeyboard.textContent = '展开完整符号键盘';
  openKeyboard.addEventListener('click', () => {
    const keyboard = window.mathVirtualKeyboard;
    if (!keyboard) return;
    keyboard.layouts = ['numeric', 'symbols', 'functions', 'greek', 'alphabetic'];
    activeField.focus();
    keyboard.show();
  });
  const advanced=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent='高级公式与更多符号';
  advanced.append(summary,help,openKeyboard);
  host.append(label, activeField, advanced);
  if (configureField) {
    activeField.mathVirtualKeyboardPolicy = 'manual';
    activeField.smartFence = true;
    activeField.smartSuperscript = true;
    activeField.inlineShortcuts = {sqrt: '\\sqrt{#0}', frac: '\\frac{#0}{#?}'};
  }
  syncing = true;
  fieldEditing = false;
  // Do not lock editing until the next paint: the user's first keystroke can arrive sooner.
  try { activeField.setValue(window.DongMathInput?.toTex(target.value) || target.value || '', {silenceNotifications: true}); }
  finally { syncing = false; }
}

function close() {
  activeTarget = null;
  visualEditing = false;
  window.mathVirtualKeyboard?.hide();
}

function edit(target,text,command){
  if(!visualEditing||target!==activeTarget||!target?.isConnected||!activeField?.isConnected||target.disabled||target.readOnly)return false;
  const commands={left:'moveToPreviousChar',right:'moveToNextChar',backspace:'deleteBackward',next:'moveToNextPlaceholder'};
  const templates={'()/()':'\\frac{#?}{#?}','√()':'\\sqrt{#?}','∛()':'\\sqrt[3]{#?}','()^()':'{#?}^{#?}'};
  Object.assign(templates,{
    '\\int  \\, dx':'\\int #?\\,dx',
    '\\int_{a}^{b}  \\, dx':'\\int_{#?}^{#?}#?\\,dx',
    '\\binom{n}{k}':'\\binom{#?}{#?}',
    '\\vec{a}':'\\vec{#?}',
    '\\left|\\vec{a}\\right|':'\\left|\\vec{#?}\\right|',
    '\\overline{AB}':'\\overline{#?}',
    '\\widehat{ABC}':'\\widehat{#?}',
    '\\sum_{i=1}^{n}':'\\sum_{i=#?}^{#?}#?',
    '\\prod_{i=1}^{n}':'\\prod_{i=#?}^{#?}#?',
    '\\lim_{x\\to 0}':'\\lim_{x\\to #?}#?',
    '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}':'\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}',
    '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}':'\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}'
  });
  syncing=true;
  try{
    if(command)activeField.executeCommand(commands[command]);
    else activeField.executeCommand(['insert',templates[text]||window.DongMathInput?.toTex(text)||text,{selectionMode:templates[text]?'placeholder':'after'}]);
    target.value=activeField.value;target.dispatchEvent(new Event('input',{bubbles:true}));
  }finally{syncing=false;fieldEditing=false;}
  activeField.focus();return true;
}
window.DongMathLive = Object.freeze({connect, close, edit, version: '0.110.0'});
document.dispatchEvent(new CustomEvent('dong-mathlive-ready'));
