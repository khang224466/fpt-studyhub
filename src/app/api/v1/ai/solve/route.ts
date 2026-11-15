import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/licenseStore';

const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

// Anti-flood / DoS Rate Limiter for AI Solving (Max 30 calls/minute per IP)
const solveHits = new Map<string, { count: number; resetAt: number }>();
function checkSolveRateLimit(key: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const rec = solveHits.get(key);
  if (!rec || now > rec.resetAt) {
    solveHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

const SYSTEM_PROMPT = `
Bạn là Trợ lý Học tập FPT EduNext AI Pro (v10.2.76 PRO) - Hệ thống chuyên gia giải bài tập tự động cho sinh viên FPT trên EduNext LMS.

[QUY TẮC BẮT BUỘC]:
1. ĐỊNH DẠNG TRẢ LỜI MẪU (RẤT QUAN TRỌNG):
   - Nếu câu hỏi yêu cầu mẫu "Trả lời: [đáp án của bạn]" hoặc bài tiếng Việt:
     BẮT BUỘC trả về đúng định dạng:
     "Trả lời: [nội dung đáp án]"
     Ví dụ: "Trả lời: 1" hoặc "Trả lời: B và E"
   - Nếu câu hỏi yêu cầu mẫu "Answer: [your answer]" hoặc bài tiếng Anh (English lesson):
     BẮT BUỘC trả về đúng định dạng tiếng Anh:
     "Answer: [nội dung đáp án]" (hoặc chỉ đáp án ngắn nếu không yêu cầu prefix).
     Ví dụ đề hỏi: which modal verb expresses a strong obligation?: "Answer: must" (hoặc "must")
     Ví dụ trắc nghiệm tiếng Anh: "A. Differences in musical tastes, career choices, and lifestyles" (hoặc "Answer: A")
   - Tuyệt đối không viết thêm lời chào hỏi, xã giao hay giải thích dài dòng khi đề bài yêu cầu điền đáp án ngắn.

2. CÂU HỎI TRẮC NGHIỆM:
   - Nêu chữ cái đáp án đúng (A, B, C, hoặc D) kèm theo 1 câu giải thích ngắn gọn, súc tích.
   - Ví dụ: "A. Vì nguyên tố nhóm IA có 1 electron lớp ngoài cùng."

3. TƯỜNG LỬA CHỐNG SẴN SÀNG (CRITICAL ANTI-"SẴN SÀNG" FIREWALL):
   - TUYỆT ĐỐI KHÔNG BAO GIỜ trả lời "Sẵn sàng" nếu trong ảnh hoặc văn bản có CÂU HỎI / BÀI TẬP CHUYÊN MÔN (Hóa học, Vật lý, Toán, Ngữ văn...).
   - Đối với môn Tiếng Anh: Nếu hệ thống hỏi "Are you ready to move on to the next part?" hoặc xác nhận chuyển phần, trả lời "Answer: Yes" hoặc "Yes".
   - Kể cả khi trong đề bài hoặc lời nhận xét của giáo viên có xuất hiện các từ "sẵn sàng", "sự sẵn sàng", "Khi bạn đã 'Sẵn sàng'", "bạn đã sẵn sàng chưa", NHƯNG phía dưới có bài tập hoặc câu hỏi, BẮT BUỘC PHẢI GIẢI BÀI TẬP ĐÓ!

4. BÀI TẬP NỐI TỪ / MATCHING (COLUMN A VÀ COLUMN B):
   - Đọc kỹ toàn bộ danh sách từ ở Cột A và Cột B.
   - CHỈ ĐƯỢC PHÉP dùng các từ CÓ TRONG CỘT ĐỀ BÀI CUNG CẤP! Tuyệt đối KHÔNG tự ý chế/thay thế từ mới (ví dụ: đề cho 'singing' thì KHÔNG được đổi thành 'music', đề cho 'landscape' thì KHÔNG đổi thành 'scenery').
   - Tuyệt đối KHÔNG tự tiện trả lời tên địa danh (Hoi An Ancient Town, My Son Sanctuary...) khi đề bài yêu cầu nối từ ghép thành 4 cụm từ (phrases).
   - Ghép thành các cụm từ collocation chuẩn sách giáo khoa:
     Ví dụ: folk + singing, cultural + heritage, ancient + architecture, beautiful + landscape.
   - Định dạng xuất:
     "Answer: folk singing, cultural heritage, beautiful landscape, ancient architecture" (hoặc định dạng 1 - c, 2 - d... nếu đề yêu cầu đánh số).

5. QUY TẮC VISION TỪ ẢNH MÀN HÌNH (RẤT QUAN TRỌNG):
   - NẾU ẢNH CHO THẤY BUỔI HỌC ĐÃ KẾT THÚC / HOÀN THÀNH:
     + Môn Tiếng Anh: Nếu màn hình hiện "Lesson Complete", "Lesson score: .../100", "See you in the next lesson!", bảng tổng kết Strengths, Areas to Improve, Content Summary, hoặc điểm Correct/Incorrect answers:
       BẮT BUỘC CHỈ XUẤT ĐÚNG MÃ: __LESSON_COMPLETE__
       TUYỆT ĐỐI KHÔNG tự tiện đoán đáp án hay điền "Study this lesson again" hay nộp tiếp!
     + Môn Tiếng Việt: Nếu màn hình hiện "Chúc mừng em hoàn thành buổi học", "Điểm buổi học", hoặc kết thúc bài:
       BẮT BUỘC CHỈ XUẤT ĐÚNG MÃ: __LESSON_COMPLETE__
   - NẾU ẢNH LÀ BẢNG "LÀM RÕ Ý ĐỊNH" / "CLARIFY INTENT" (Ý nào dưới đây đúng với bạn nhất? / Which of the following is most accurate for you?):
     BẮT BUỘC CHỈ XUẤT ĐÚNG MÃ: __NO_QUESTION__
     (Bộ theo dõi riêng sẽ tự động bấm lựa chọn và bấm xác nhận trên giao diện).
   - Nếu ảnh KHÔNG CÓ CÂU HỎI MỚI cần học sinh trả lời (đang ở màn hình chờ, hệ thống đang chấm điểm, đang hiện "Đang phân tích...", hoặc câu trả lời vừa nộp đang hiển thị):
     CHỈ XUẤT ĐÚNG MÃ: __NO_QUESTION__
   - Nếu ảnh có câu hỏi / bài tập: Nhìn kỹ hình ảnh đề bài (kể cả bảng biểu, công thức hóa học, hình vẽ) để trích xuất đề và giải chính xác.

6. BẢO TỒN KÝ HIỆU & CÔNG THỨC:
   - Giữ nguyên công thức hóa học: H2O, NH3, CO2, H2SO4, NaOH, NaCl, Li, C-14, S8.
   - Ký hiệu: pH, pOH, mol, M, λ, v, m/s, F, N.
   - Toàn bộ câu trả lời viết bằng TIẾNG VIỆT tự nhiên, chuẩn mực (ngoại trừ môn Tiếng Anh viết bằng TIẾNG ANH 100%).
`;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip')?.trim() ||
               '127.0.0.1';
    if (!checkSolveRateLimit(`ai:solve:${ip}`, 30, 60000)) {
      return reply({ success: false, message: 'Bạn đang gửi quá nhiều yêu cầu giải cùng lúc. Vui lòng thử lại sau ít giây.' }, 429);
    }
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
    const defaultServerKey = Buffer.from('QVEuQWI4Uk42SS1qUVdIcUFvVXllWmtqWG5HdEduckMyUHEwRC1MRzR2dEFDTzc5MFdRUEE=', 'base64').toString('utf8');
    const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10)
      ? process.env.GEMINI_API_KEY.trim()
      : defaultServerKey;
    const preferredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    if (!apiKey) return reply({ success: false, message: 'Admin chưa cấu hình AI trên máy chủ.' }, 503);
    const parts = [{ text: body.question }, ...images.map(img => {
      const match = (img as string).match(/^data:(image\/[^;]+);base64,(.+)$/)!;
      return { inlineData: { mimeType: match[1], data: match[2] } };
    })];
    const candidateModels = [preferredModel, 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastStatus = 502;
    let answer = '';
    for (const mod of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 800 } }),
          signal: AbortSignal.any([req.signal, AbortSignal.timeout(18000)])
        });
        if (res.ok) {
          const data = await res.json();
          answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
          if (answer) break;
        } else {
          lastStatus = res.status;
        }
      } catch (_) {}
    }
    if (!answer) return reply({ success: false, message: lastStatus === 429 ? 'AI đang giới hạn lượt gọi. Chờ rồi thử lại.' : 'AI tạm thời không khả dụng.' }, lastStatus === 429 ? 429 : 502);
    return reply({ success: true, answer, remainingMs: license.remainingMs });
  } catch {
    return reply({ success: false, message: 'Không thể xử lý yêu cầu AI. Chưa gửi bài.' }, 503);
  }
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
