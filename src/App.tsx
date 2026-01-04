import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, InputNumber, Space, message, Spin } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SettingOutlined } from '@ant-design/icons';
import CameraCapture from './components/CameraCapture';
import WordList, { WordItem } from './components/WordList';
import { recognizeText } from './utils/ocr';
import { segmentWords } from './utils/wordSegment';
import { speakText, stopSpeaking } from './utils/tts';
import './App.css';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(3);
  const [isPaused, setIsPaused] = useState(false);
  
  const speakingIndexRef = useRef<number>(-1);
  const timeoutRef = useRef<number | null>(null);

  // 处理图片捕获
  const handleImageCapture = async (file: File) => {
    setImageFile(file);
    setIsProcessing(true);
    setWords([]);
    setSelectedWordId(null);
    
    try {
      // OCR识别
      const text = await recognizeText(file);
      console.log('OCR识别结果:', text);
      
      // 切词处理
      const wordTexts = segmentWords(text);
      console.log('切词结果:', wordTexts);
      
      // 创建词语列表
      const wordItems: WordItem[] = wordTexts.map((text, index) => ({
        id: index,
        text,
        selected: index === 0, // 默认选中第一个
      }));
      
      setWords(wordItems);
      setSelectedWordId(0);
      message.success(`识别成功，共找到 ${wordItems.length} 个词语`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 选择词语
  const handleSelectWord = (id: number) => {
    setWords(prevWords =>
      prevWords.map(word => ({
        ...word,
        selected: word.id === id,
      }))
    );
    setSelectedWordId(id);
  };

  // 删除词语
  const handleDeleteWord = (id: number) => {
    setWords(prevWords => {
      const newWords = prevWords.filter(word => word.id !== id);
      // 重新分配ID，保持连续
      const reindexedWords = newWords.map((word, index) => ({
        ...word,
        id: index,
        selected: index === 0 && newWords.length > 0,
      }));
      
      // 如果删除的是当前选中的，选中第一个
      if (id === selectedWordId) {
        setSelectedWordId(newWords.length > 0 ? 0 : null);
      }
      
      return reindexedWords;
    });
  };

  // 开始听写
  const handleStartDictation = async () => {
    if (words.length === 0) {
      message.warning('请先拍照识别词语');
      return;
    }

    if (selectedWordId === null) {
      message.warning('请先选择一个词语');
      return;
    }

    // 如果正在朗读，先停止
    if (isSpeaking) {
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    setIsSpeaking(true);
    setIsPaused(false);
    
    // 从选中的词语开始
    const startIndex = selectedWordId;
    speakingIndexRef.current = startIndex;

    // 开始朗读流程
    await speakWordsFromIndex(startIndex);
  };

  // 从指定索引开始朗读词语
  const speakWordsFromIndex = async (startIndex: number) => {
    if (isPaused) {
      return;
    }

    for (let i = startIndex; i < words.length; i++) {
      if (isPaused) {
        speakingIndexRef.current = i;
        break;
      }

      const word = words[i];
      speakingIndexRef.current = i;
      
      // 更新选中状态
      handleSelectWord(word.id);

      try {
        // 朗读当前词语
        await speakText(word.text);
        
        // 如果不是最后一个词语，等待指定时间间隔
        if (i < words.length - 1 && !isPaused) {
          await new Promise<void>((resolve) => {
            timeoutRef.current = window.setTimeout(() => {
              resolve();
            }, intervalSeconds * 1000);
          });
        }
      } catch (error) {
        console.error('朗读失败:', error);
        message.error('朗读失败');
        break;
      }
    }

    // 朗读完成
    if (!isPaused) {
      setIsSpeaking(false);
      speakingIndexRef.current = -1;
      message.success('听写完成');
    }
  };

  // 暂停/继续
  const handlePause = () => {
    if (isPaused) {
      // 继续
      setIsPaused(false);
      const currentIndex = speakingIndexRef.current;
      if (currentIndex >= 0 && currentIndex < words.length) {
        speakWordsFromIndex(currentIndex);
      }
    } else {
      // 暂停
      setIsPaused(true);
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="app-container">
      <Card title="听写学习应用" style={{ maxWidth: '800px', margin: '20px auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 拍照区域 */}
          <div>
            <h3>1. 拍照识别</h3>
            <Spin spinning={isProcessing}>
              <CameraCapture
                onImageCapture={handleImageCapture}
                disabled={isProcessing || isSpeaking}
              />
            </Spin>
          </div>

          {/* 词语列表 */}
          <div>
            <h3>2. 词语列表（点击选择，可删除）</h3>
            <WordList
              words={words}
              onSelectWord={handleSelectWord}
              onDeleteWord={handleDeleteWord}
            />
          </div>

          {/* 设置和控制 */}
          <div>
            <h3>3. 听写设置</h3>
            <Space>
              <span>朗读间隔（秒）：</span>
              <InputNumber
                min={1}
                max={60}
                value={intervalSeconds}
                onChange={(value) => setIntervalSeconds(value || 3)}
                disabled={isSpeaking}
                addonBefore={<SettingOutlined />}
              />
            </Space>
          </div>

          {/* 开始按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={isSpeaking ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleStartDictation}
              disabled={words.length === 0 || selectedWordId === null}
              loading={isProcessing}
            >
              {isSpeaking ? '停止听写' : '开始听写'}
            </Button>
            {isSpeaking && (
              <Button
                style={{ marginLeft: '10px' }}
                onClick={handlePause}
              >
                {isPaused ? '继续' : '暂停'}
              </Button>
            )}
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default App;

