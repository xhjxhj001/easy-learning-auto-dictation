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
    <List
      dataSource={words}
      renderItem={(item) => (
        <List.Item
          style={{
            cursor: 'pointer',
            backgroundColor: item.selected ? '#e6f7ff' : 'transparent',
            border: item.selected ? '2px solid #1890ff' : '1px solid #f0f0f0',
            borderRadius: '4px',
            marginBottom: '8px',
            padding: '12px',
          }}
          onClick={() => onSelectWord(item.id)}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Tag
              color={item.selected ? 'blue' : 'default'}
              style={{ fontSize: '16px', padding: '4px 12px' }}
            >
              {item.text}
            </Tag>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteWord(item.id);
              }}
            >
              删除
            </Button>
          </Space>
        </List.Item>
      )}
    />
  );
};

export default WordList;

