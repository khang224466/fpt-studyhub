import { ServiceItem } from '@/types/rental';

export const SERVICES_CATALOG: ServiceItem[] = [
  {
    id: 'edunext-assistant',
    name: 'FPT EduNext AI Assistant Pro',
    slug: 'edunext-assistant',
    category: 'edunext',
    categoryLabel: 'EduNext LMS',
    tagline: 'Trợ lý học tập thông minh v10.2.51: Tự động chạy liên tục (Auto Loop), giải bài siêu tốc, kiểm soát hạn dùng bản quyền, bảo mật 100%',
    iconName: 'GraduationCap',
    targetDomain: 'fsc-edunext.fpt.edu.vn',
    authMethod: 'extensionBridge',
    badge: 'Đang Hoạt Động (v10.2.51)',
    isComingSoon: false,
    features: [
      'Auto Loop 100%: Tự động giải liên tục từ câu đầu đến khi hoàn thành bài học',
      'Giới hạn mở rộng: Thoải mái giải 3 bài/tuần cho mỗi môn (Áp dụng cho mọi gói bản quyền)',
      'Tích hợp thời hạn bản quyền tự động (1 Tuần, 1 Tháng, 1 Kỳ) minh bạch',
      'Cloud AI Proxy & Gemini 2.0 Flash-Lite: Trả lời siêu tốc trong 1.2s',
      'Đồng bộ React 18 Fiber 5 tầng, tự động kích hoạt onSendMessage & Enter',
      'Cơ chế chống 429 Too Many Requests thông minh với backoff tự động',
      'Bookmarklet 1-Click Zero-Install độc lập v10.2.51 (Không cần Tampermonkey)'
    ],
    plans: [
      { id: 'edunext-1w', duration: '1w', durationLabel: '1 Tuần', price: 30000, originalPrice: 50000 },
      { id: 'edunext-1m', duration: '1m', durationLabel: '1 Tháng', price: 69000, originalPrice: 110000 },
      { id: 'edunext-semester', duration: 'semester', durationLabel: '1 Kỳ Học (4 Tháng)', price: 220000, originalPrice: 350000, isPopular: true, badge: 'Khuyên Dùng' }
    ],
    activeUsersCount: 3820,
    rating: 4.98,
    accentColor: '#10b981'
  },
  {
    id: 'khaothi-online',
    name: 'FPT Khảo Thí Online — Cổng Ôn Luyện & Đề Thi Thử',
    slug: 'khaothi-online',
    category: 'khaothi',
    categoryLabel: 'Khảo Thí Online',
    tagline: 'Ngân hàng câu hỏi trắc nghiệm, đề thi thử các môn cơ sở & chuyên ngành kèm lời giải chi tiết',
    iconName: 'FileCheck',
    targetDomain: 'khaothionline.fpt.edu.vn',
    authMethod: 'localStorage',
    badge: 'Sắp Ra Mắt',
    isComingSoon: true,
    features: [
      'Kho đề thi thử sát với cấu trúc đề thi chính thức tại FPT',
      'Phân tích đáp án chi tiết và chỉ ra bẫy thường gặp trong câu hỏi trắc nghiệm',
      'Tóm tắt công thức và kiến thức trọng tâm cho từng môn học',
      'Hỗ trợ chế độ thi thử tính giờ y hệt phòng thi thực tế',
      'Thống kê điểm số và cảnh báo phần kiến thức bạn còn yếu'
    ],
    plans: [],
    activeUsersCount: 0,
    rating: 5.0,
    accentColor: '#3b82f6'
  },
  {
    id: 'seb-toolkit',
    name: 'Safe Exam Browser (SEB) Toolkit & Hỗ Trợ Kỳ Thi',
    slug: 'seb-toolkit',
    category: 'seb',
    categoryLabel: 'Safe Exam Browser',
    tagline: 'Bộ công cụ chuẩn hóa cấu hình SEB, kiểm tra môi trường máy trước giờ G và xử lý sự cố thi',
    iconName: 'ShieldAlert',
    targetDomain: 'khaothionline.fpt.edu.vn',
    authMethod: 'sessionStorage',
    badge: 'Sắp Ra Mắt',
    isComingSoon: true,
    features: [
      'Kiểm tra và chuẩn hóa cấu hình file .seb tương thích máy tính Windows & Mac',
      'Phát hiện và cảnh báo các ứng dụng chạy ngầm gây đơ/crash SEB',
      'Hướng dẫn khắc phục sự cố rớt mạng, treo màn hình trong khi đang làm bài thi',
      'Môi trường thi thử nghiệm mô phỏng giao diện SEB trước ngày thi chính thức',
      'Hỗ trợ kỹ thuật 1-1 trước giờ thi xử lý các lỗi certificate, camera, micro'
    ],
    plans: [],
    activeUsersCount: 0,
    rating: 5.0,
    accentColor: '#f59e0b'
  }
];

export const BANK_CONFIG = {
  bankId: 'VIB', // Ngân hàng TMCP Quốc Tế Việt Nam (VIB)
  bankName: 'Ngân hàng Quốc Tế (VIB)',
  accountNo: '858709070',
  accountName: 'DIEP DAI PHU',
  qrTemplate: 'compact2',
  qrStaticImage: '/qr_69k.jpg',
  qr30k: '/qr_30k.jpg',
  qr69k: '/qr_69k.jpg',
  qr220k: '/qr_220k.png',
  discordContactUrl: 'https://discord.com/users/888713971161505832'
};
