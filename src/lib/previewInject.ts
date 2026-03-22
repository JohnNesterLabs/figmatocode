/**
 * previewInject.ts
 * 
 * This module exports a JavaScript string that will be injected into the
 * WebContainer preview iframe. It enables element selection for visual editing.
 * 
 * The script:
 * - Listens for { type: "ve-enable" } from the parent → activates mode
 * - Highlights hovered elements with a blue overlay
 * - On click → serializes the element and posts { type: "ve-select", element } to parent
 * - Listens for { type: "ve-disable" } → deactivates
 */

export const VISUAL_EDIT_SCRIPT = /* javascript */ `
(function() {
  let isVEActive = false;
  let highlightEl = null;
  let currentHovered = null;

  // Create the highlight overlay element
  function createHighlight() {
    const el = document.createElement('div');
    el.id = '__ve_highlight__';
    el.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483647',
      'border: 2px solid #3b82f6',
      'background: rgba(59, 130, 246, 0.08)',
      'border-radius: 3px',
      'transition: all 0.1s ease',
      'box-shadow: 0 0 0 1px rgba(59,130,246,0.3)',
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  // Create a label badge showing tag name
  function createLabel() {
    const el = document.createElement('div');
    el.id = '__ve_label__';
    el.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483647',
      'background: #3b82f6',
      'color: white',
      'font-size: 11px',
      'font-family: monospace',
      'padding: 2px 6px',
      'border-radius: 3px',
      'white-space: nowrap',
      'transform: translateY(-100%)',
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  // Move the highlight overlay to cover a given element
  function positionHighlight(target) {
    if (!highlightEl) return;
    const rect = target.getBoundingClientRect();
    const label = document.getElementById('__ve_label__');
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
    highlightEl.style.display = 'block';
    if (label) {
      label.textContent = target.tagName.toLowerCase() + (target.className ? '.' + [...target.classList].slice(0, 2).join('.') : '');
      label.style.top = (rect.top - 1) + 'px';
      label.style.left = rect.left + 'px';
      label.style.display = 'block';
    }
  }

  function hideHighlight() {
    if (highlightEl) highlightEl.style.display = 'none';
    const label = document.getElementById('__ve_label__');
    if (label) label.style.display = 'none';
  }

  // Build a unique-ish CSS selector path for an element
  function buildSelector(el) {
    if (!el || el === document.body) return 'body';
    const parts = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += '#' + current.id;
        parts.unshift(part);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = [...current.classList].slice(0, 3);
        if (classes.length) part += '.' + classes.join('.');
      }
      // Add nth-child to disambiguate siblings
      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  // Extract relevant computed styles
  function getRelevantStyles(el) {
    const cs = window.getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      marginTop: cs.marginTop,
      marginRight: cs.marginRight,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      borderRadius: cs.borderRadius,
      borderColor: cs.borderColor,
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      display: cs.display,
      flexDirection: cs.flexDirection,
      alignItems: cs.alignItems,
      justifyContent: cs.justifyContent,
      width: cs.width,
      height: cs.height,
      opacity: cs.opacity,
      textAlign: cs.textAlign,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
    };
  }

  // Post element info to parent window
  function selectElement(target) {
    const rect = target.getBoundingClientRect();
    const veHost = target.closest && target.closest('[data-ve-id]');
    const veId = veHost ? veHost.getAttribute('data-ve-id') : null;
    const info = {
      veId: veId || '',
      selector: buildSelector(target),
      tagName: target.tagName.toLowerCase(),
      className: typeof target.className === 'string' ? target.className : '',
      innerHTML: target.innerHTML.slice(0, 2000), // limit size
      textContent: target.textContent.slice(0, 500),
      computedStyles: getRelevantStyles(target),
      boundingClientRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      // Include inline style string
      inlineStyle: target.getAttribute('style') || '',
    };
    window.parent.postMessage({ type: 've-select', element: info }, '*');
  }

  // Event handlers
  function onMouseOver(e) {
    if (!isVEActive) return;
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.id === '__ve_highlight__' || target.id === '__ve_label__') return;
    currentHovered = target;
    positionHighlight(target);
  }

  function onMouseOut(e) {
    if (!isVEActive) return;
    hideHighlight();
    currentHovered = null;
  }

  function onClick(e) {
    if (!isVEActive) return;
    const target = e.target;
    if (!target || target.id === '__ve_highlight__' || target.id === '__ve_label__') return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(target);
  }

  function enable() {
    if (isVEActive) return;
    isVEActive = true;
    document.body.style.cursor = 'crosshair';
    highlightEl = document.getElementById('__ve_highlight__') || createHighlight();
    if (!document.getElementById('__ve_label__')) createLabel();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    window.parent.postMessage({ type: 've-ready' }, '*');
  }

  function disable() {
    if (!isVEActive) return;
    isVEActive = false;
    document.body.style.cursor = '';
    hideHighlight();
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
  }

  // Listen for commands from parent
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 've-enable') enable();
    else if (e.data.type === 've-disable') disable();
  });
})();
`;

/**
 * Wrap the visual edit script into an index.html <script> tag injection.
 * Returns the HTML string with the script block appended before </body>.
 */
export function injectVisualEditScript(indexHtml: string): string {
  const scriptTag = `<script>\n${VISUAL_EDIT_SCRIPT}\n<\/script>`;
  if (indexHtml.includes('</body>')) {
    return indexHtml.replace('</body>', `${scriptTag}\n</body>`);
  }
  return indexHtml + '\n' + scriptTag;
}
