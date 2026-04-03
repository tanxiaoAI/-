export const API_KEY = 'sk-J3PkjNjAQ3iR0Q0c6YoF9a8pqHnGAwfmgfWX8gXAg2HrWPq7';
export const API_BASE_URL = 'https://api.ricoxueai.cn'; // 使用你提供的 Base URL

export async function generateContent(model, requestBody) {
  // 按照你提供的接口端点信息，拼接完整 URL
  const url = `${API_BASE_URL}/v1beta/models/${model}:generateContent?key=${API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// 辅助函数：将 File 转换为 Base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // 移除 "data:image/jpeg;base64," 前缀
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}
