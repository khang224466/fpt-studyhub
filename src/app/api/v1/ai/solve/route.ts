import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/licenseStore';

const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const SYSTEM_PROMPT = `
Bạn là Trợ lý Học tập FPT EduNext AI Pro (v10.2.57 PRO) - Hệ thống chuyên gia giải bài tập tự động cho sinh viên FPT trên EduNext LMS.

[QUY TẮC BẮT BUỘC]:
1. ĐỊNH DẠNG TRẢ LỜI MẪU (RẤT QUAN TRỌNG):
   - Nếu câu hỏi có yêu cầu mẫu "Trả lời: [đáp án của bạn]" hoặc "Answer: [your answer]":
     BẮT BUỘC chỉ trả về đúng định dạng:
     "Trả lời: [nội dung đáp án]"
     Ví dụ đề hỏi Li có bao nhiêu electron lớp ngoài cùng: "Trả lời: 1"
     Ví dụ đề hỏi các nguyên tử cùng thuộc 1 nguyên tố hoá học: "Trả lời: B và E"
     Ví dụ đề hỏi số neutron (16 - [...] = ?): "Trả lời: 16 - 8 = 8" (hoặc "Trả lời: 8")
   - Tuyệt đối không viết thêm lời chào hỏi, xã giao hay giải thích dài dòng khi đề bài yêu cầu điền đáp án ngắn.

2. CÂU HỎI TRẮC NGHIỆM:
   - Nêu chữ cái đáp án đúng (A, B, C, hoặc D) kèm theo 1 câu giải thích ngắn gọn, súc tích.
   - Ví dụ: "A. Vì nguyên tố nhóm IA có 1 electron lớp ngoài cùng."

3. TƯỜNG LỬA CHỐNG SẴN SÀNG (CRITICAL ANTI-"SẴN SÀNG" FIREWALL):
   - TUYỆT ĐỐI KHÔNG BAO GIỜ trả lời "Sẵn sàng" nếu trong ảnh hoặc văn bản có CÂU HỎI / BÀI TẬP CHUYÊN MÔN (Hóa học, Vật lý, Toán, Ngữ văn, Tiếng Anh...).
   - Kể cả khi trong đề bài hoặc lời nhận xét của giáo viên có xuất hiện các từ "sẵn sàng", "sự sẵn sàng", "Khi bạn đã 'Sẵn sàng'", "bạn đã sẵn sàng chưa", NHƯNG phía dưới có bài tập hoặc câu hỏi, BẮT BUỘC PHẢI GIẢI BÀI TẬP ĐÓ!
   - CHỈ ĐƯỢC trả lời "Sẵn sàng" khi và chỉ khi: ĐÂY LÀ MÀN HÌNH CHUYỂN PHẦN THUẦN TÚY (chỉ có câu: "Bạn đã sẵn sàng chuyển sang phần tiếp theo chưa?" và KHÔNG có bất kỳ bài tập hay câu hỏi nào khác).

4. QUY TẮC VISION TỪ ẢNH MÀN HÌNH:
   - Nếu ảnh cho thấy buổi học ĐÃ KẾT THÚC hoặc có lời chúc mừng hoàn thành bài học, CHỈ XUẤT ĐÚNG MÃ: __LESSON_COMPLETE__
   - Nếu ảnh KHÔNG CÓ CÂU HỎI MỚI cần học sinh trả lời (đang ở màn hình chờ, hệ thống đang chấm điểm, đang hiện "Đang phân tích...", hoặc câu trả lời vừa nộp đang hiển thị), CHỈ XUẤT ĐÚNG MÃ: __NO_QUESTION__
   - Nếu ảnh có câu hỏi / bài tập: Nhìn kỹ hình ảnh đề bài (kể cả bảng biểu, công thức hóa học, hình vẽ) để trích xuất đề và giải chính xác.

5. BẢO TỒN KÝ HIỆU & CÔNG THỨC:
   - Giữ nguyên công thức hóa học: H2O, NH3, CO2, H2SO4, NaOH, NaCl, Li, C-14.
   - Ký hiệu: pH, pOH, mol, M, λ, v, m/s, F, N.
   - Toàn bộ câu trả lời viết bằng TIẾNG VIỆT tự nhiên, chuẩn mực (ngoại trừ môn Tiếng Anh).
`;

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > 3500000) return reply({ success: false, message: 'Ảnh quá lớn.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return reply({ success: false, message: 'JSON không hợp lệ.' }, 400); }
    if (!body || typeof body !== 'object') return reply({ success: false }, 400);
    if (['apiKey', 'apiKeyOverride', 'rawKey', 'key'].some(key => key in body)) return reply({ success: false, message: 'API key chỉ được cấu hình trên máy chủ.' }, 400);
    const license = await verifyLicense(body.licenseKey);
    if (!license.valid) return reply({ success: false, message: license.reason }, 403);
    if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 16000) return reply({ success: false, message: 'Câu hỏi không hợp lệ.' }, 400);
    const images: unknown[] = body.images === undefined ? [] : body.images;
    if (!Array.isArray(images) || images.length > 2 || images.some(img => typeof img !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(img))) return reply({ success: false, message: 'Định dạng ảnh không hợp lệ.' }, 400);
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    if (!apiKey || !/^[a-zA-Z0-9.-]+$/.test(model)) return reply({ success: false, message: 'Admin chưa cấu hình AI trên máy chủ.' }, 503);
    const parts = [{ text: body.question }, ...images.map(img => {
      const match = (img as string).match(/^data:(image\/[^;]+);base64,(.+)$/)!;
      return { inlineData: { mimeType: match[1], data: match[2] } };
    })];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 800 } }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(20000)])
    });
    if (!res.ok) return reply({ success: false, message: res.status === 429 ? 'AI đang giới hạn lượt gọi. Chờ rồi thử lại.' : 'AI tạm thời không khả dụng.' }, res.status === 429 ? 429 : 502);
    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
    if (!answer) return reply({ success: false, message: 'AI chưa trả về đáp án. Chưa gửi bài.' }, 502);
    return reply({ success: true, answer, remainingMs: license.remainingMs });
  } catch {
    return reply({ success: false, message: 'Không thể xử lý yêu cầu AI. Chưa gửi bài.' }, 503);
  }
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
