import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface MentionListProps {
  items: any[];
  command: (item: any) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: `${item.subject} / ${item.title}` });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-popover border border-divider rounded-lg shadow-xl overflow-hidden w-64 p-1">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex flex-col gap-0.5 ${
              index === selectedIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-hover'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <span className="font-medium">{item.title}</span>
            <span className={`text-[10px] uppercase tracking-wider ${index === selectedIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {item.subject}
            </span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
