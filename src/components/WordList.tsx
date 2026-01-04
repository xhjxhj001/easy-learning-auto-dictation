import React from 'react';
import { List, Button, Space, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export interface WordItem {
  id: number;
  text: string;
  selected: boolean;
}

interface WordListProps {
  words: WordItem[];
  onSelectWord: (id: number) => void;
  onDeleteWord: (id: number) => void;
}

const WordList: React.FC<WordListProps> = ({ words, onSelectWord, onDeleteWord }) => {
  if (words.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        暂无词语，请先拍照识别
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '10px',
      padding: '4px'
    }}>
      {words.map((item) => (
        <div
          key={item.id}
          onClick={() => onSelectWord(item.id)}
          style={{
            cursor: 'pointer',
            backgroundColor: item.selected ? '#e6f7ff' : '#fff',
            border: item.selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: item.selected ? '0 2px 6px rgba(24, 144, 255, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
            // 确保长词可以换行，且不会被挤压
            maxWidth: '100%',
            flexGrow: 0,
            flexShrink: 0
          }}
        >
          <span style={{ 
            fontSize: '18px', 
            fontWeight: item.selected ? '600' : '400',
            color: item.selected ? '#1890ff' : '#333',
            wordBreak: 'break-all',
            lineHeight: '1.4',
            flex: 1
          }}>
            {item.text}
          </span>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{ 
              flexShrink: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px',
              backgroundColor: item.selected ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
              borderRadius: '50%'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteWord(item.id);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default WordList;

