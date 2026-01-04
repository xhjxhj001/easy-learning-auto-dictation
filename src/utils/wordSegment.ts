/**
 * 将文本切分成词语列表
 * 按照图片中的顺序（从左到右，从上到下）排列
 * @param text OCR识别出的文本（可能包含换行符，因为OCR按行识别）
 * @returns 词语列表
 */
export function segmentWords(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 第一步：合并所有段落，移除换行符（因为OCR可能因为折行将一个词语拆开）
  // 将换行符替换为空格，这样被折行拆开的词语可以重新合并
  let merged = text
    .replace(/\r\n/g, ' ')  // Windows换行符 -> 空格
    .replace(/\n/g, ' ')    // Unix换行符 -> 空格
    .replace(/\r/g, ' ')    // Mac换行符 -> 空格
    .trim();

  // 第二步：先按标点符号进行段落切分（标点符号是明确的分隔符）
  // 定义标点符号分隔符：中文标点、英文标点
  const punctuationSeparators = /[，。、；：！？,.;:!?，。、；：！？]+/;
  const paragraphs = merged.split(punctuationSeparators).filter(p => p.trim().length > 0);
  
  // 第三步：处理每个段落，智能切分词语
  const words: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    // 对于每个段落，先移除多余空格，然后进行智能切分
    const cleaned = paragraph.replace(/\s+/g, ' ').trim();
    
    // 检查是否包含中文字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(cleaned);
    
    if (hasChinese) {
      // 对于包含中文的段落，使用智能切分
      // 策略：连续的中文字符作为一个词语，英文/数字作为独立词语
      const chineseWords = segmentChineseText(cleaned);
      words.push(...chineseWords);
    } else {
      // 纯英文/数字，按空格切分
      const englishWords = cleaned.split(/\s+/).filter(w => w.length > 0);
      words.push(...englishWords);
    }
  }
  
  // 第四步：如果段落切分后没有结果，尝试直接按空格和标点切分（兜底策略）
  if (words.length === 0) {
    const fallbackSeparators = /[\s，。、；：！？,.;:!?，。、；：！？\u3000]+/;
    const fallbackWords = merged.split(fallbackSeparators).filter(w => w.trim().length > 0);
    if (fallbackWords.length > 0) {
      return fallbackWords;
    }
    // 最后的兜底：按字符分割
    return merged.split('').filter(char => char.trim().length > 0);
  }
  
  return words.filter(word => word.trim().length > 0);
}

/**
 * 智能切分包含中文的文本
 * 将连续的中文字符作为一个词语，英文/数字作为独立词语
 * 处理空格：如果空格两边都是中文，则忽略空格（可能是折行导致的）
 * @param text 包含中文的文本（已经移除了标点符号）
 * @returns 词语数组
 */
function segmentChineseText(text: string): string[] {
  const words: string[] = [];
  let currentWord = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isChinese = /[\u4e00-\u9fa5]/.test(char);
    const isEnglishOrNumber = /[a-zA-Z0-9]/.test(char);
    const isSpace = /\s/.test(char);
    
    if (isChinese) {
      // 中文字符：如果当前词语是英文/数字，先保存，然后开始新的中文词语
      if (currentWord && /[a-zA-Z0-9]/.test(currentWord)) {
        words.push(currentWord);
        currentWord = char;
      } else {
        // 连续的中文字符作为一个词语（忽略中间的空格）
        currentWord += char;
      }
    } else if (isEnglishOrNumber) {
      // 英文/数字：如果当前词语是中文，先保存，然后开始新的英文词语
      if (currentWord && /[\u4e00-\u9fa5]/.test(currentWord)) {
        words.push(currentWord);
        currentWord = char;
      } else {
        // 连续的英文/数字作为一个词语
        currentWord += char;
      }
    } else if (isSpace) {
      // 空格：如果当前词语是中文，且下一个字符也是中文，则忽略空格（可能是折行导致的）
      // 否则，如果当前有词语，先保存
      if (currentWord && /[\u4e00-\u9fa5]/.test(currentWord)) {
        // 检查下一个字符是否是中文
        const nextChar = text[i + 1];
        if (nextChar && /[\u4e00-\u9fa5]/.test(nextChar)) {
          // 空格两边都是中文，忽略空格，继续当前词语
          continue;
        } else {
          // 下一个字符不是中文，保存当前词语
          words.push(currentWord);
          currentWord = '';
        }
      } else if (currentWord) {
        // 当前词语是英文/数字，空格作为分隔符
        words.push(currentWord);
        currentWord = '';
      }
      // 如果currentWord为空，忽略空格
    } else {
      // 其他字符（如特殊符号等）：如果当前有词语，先保存
      if (currentWord) {
        words.push(currentWord);
        currentWord = '';
      }
      // 其他字符本身不作为词语，跳过
    }
  }
  
  // 保存最后一个词语
  if (currentWord) {
    words.push(currentWord);
  }
  
  return words;
}

