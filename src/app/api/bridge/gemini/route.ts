// Next.js API route that proxies Gemini generateContent requests from the AI Bridge
// Path: /api/bridge/gemini
// The Bridge posts a JSON payload containing:
//   model: string – e.g. "gemini-flash-lite-latest"
//   apiKey: string – valid Gemini API key ("AQ...." or "AIza...")
//   promptText: string – the user question
//   imageBase64?: string – optional base64 image data (without data URI prefix)
// The route forwards the request to Google Generative Language API and returns the raw JSON.

import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  try {
    const { model, apiKey, promptText, imageBase64 } = await req.json();
    if (!model || !apiKey) {
      return NextResponse.json({ error: 'Missing model or apiKey' }, { status: 400 });
    }

    // Build the Gemini request body – same shape the Bridge previously used
    const parts: any[] = [];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }
    parts.push({ text: promptText || 'Giải bài tập trên ảnh' });

    const body = {
      contents: [{ role: 'user', parts }],
      systemInstruction: {
        parts: [{
          text: 'Bạn là Trợ lý Học tập FPT EduNext AI Pro. Đọc kỹ câu hỏi và mọi phản hồi, gợi ý của giáo viên. Nếu giáo viên vừa từ chối câu trả lời trước, tuyệt đối không lặp lại câu sai cũ mà phải đưa ra đáp án mới đúng theo gợi ý. Trả lời đúng mẫu yêu cầu (ví dụ: "Trả lời: [đáp án]").'
        }]
      },
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    // Forward status code and JSON directly – Bridge only checks res.ok and parses JSON.
    return new NextResponse(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Bridge Gemini proxy error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
};
