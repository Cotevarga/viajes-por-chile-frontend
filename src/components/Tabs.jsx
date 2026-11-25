import { useId, useRef } from 'react';

export default function Tabs({ label, tabs, active, onChange, children }) {
  const id = useId();
  const buttons = useRef([]);
  const selected = tabs.findIndex((tab) => tab.id === active);

  function onKeyDown(event) {
    let next;
    if (event.key === 'ArrowRight') next = (selected + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (selected + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return <>
    <div className="section-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => <button
        key={tab.id}
        ref={(element) => { buttons.current[index] = element; }}
        type="button"
        role="tab"
        id={`${id}-tab-${tab.id}`}
        aria-controls={`${id}-panel-${tab.id}`}
        aria-selected={active === tab.id}
        tabIndex={active === tab.id ? 0 : -1}
        onClick={() => onChange(tab.id)}
      >{tab.label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel-${active}`} aria-labelledby={`${id}-tab-${active}`}>
      {children}
    </div>
  </>;
}
