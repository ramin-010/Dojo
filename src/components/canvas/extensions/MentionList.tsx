import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Hash, FolderOpen } from 'lucide-react';

interface MentionListProps {
  items: any[];
  command: (item: any) => void;
  onMentionAdd?: (id: string) => void;
  editor?: any;
  range?: any;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      if (item.isSubject && props.editor && props.range) {
        props.editor
          .chain()
          .focus()
          .deleteRange(props.range)
          .insertContent(`@/${item.title}/`)
          .run();
      } else {
        props.command({ id: item.id, label: `${item.title}` });
        if (props.onMentionAdd) {
          props.onMentionAdd(item.id);
        }
      }
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
    <div className="bg-[#1c1c1c] border border-[#2c2c2c] rounded-xl shadow-2xl overflow-hidden w-72 p-1.5 backdrop-blur-md">
      <div className="px-2 pb-1.5 pt-1 border-b border-[#2c2c2c] mb-1">
        <span className="text-[10px] font-semibold text-[#666666] tracking-widest uppercase">
          Suggest Mentions
        </span>
      </div>
      {props.items.length ? (
        <div className="flex flex-col gap-0.5">
          {props.items.map((item, index) => (
            <button
              className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                index === selectedIndex ? 'bg-blue-500/10 text-blue-400' : 'text-[#a0a0a0] hover:bg-[#2c2c2c] hover:text-[#d0d0d0]'
              }`}
              key={index}
              onClick={() => selectItem(index)}
            >
              <div className={`p-1.5 rounded-md ${index === selectedIndex ? 'bg-blue-500/20 text-blue-400' : 'bg-[#2c2c2c] text-[#666666]'}`}>
                {item.isSubject ? <FolderOpen className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className={`font-medium truncate ${index === selectedIndex ? 'text-blue-400' : 'text-[#d0d0d0]'}`}>
                  {item.title}
                </span>
                <span className={`text-[10px] uppercase tracking-wider truncate ${index === selectedIndex ? 'text-blue-500/60' : 'text-[#666666]'}`}>
                  {item.subject}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-sm text-[#666666]">No topics found</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
