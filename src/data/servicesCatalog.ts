import { ServiceItem } from '@/types/rental';

export const SERVICES_CATALOG: ServiceItem[] = [
  {
    id: 'edunext-assistant',
    name: 'FPT EduNext AI Assistant Pro',
    slug: 'edunext-assistant',
    category: 'edunext',
    categoryLabel: 'EduNext LMS',
    tagline: 'Trợ lý học tập thông minh v10.2.2: Bảo mật License Key, tự động nộp bài 100%, Cloud AI Proxy mã hóa API Key, chống 429 Rate Limit',
    iconName: 'GraduationCap',
    targetDomain: 'fsc-edunext.fpt.edu.vn',
    authMethod: 'extensionBridge',
    badge: 'Đang Hoạt Động (v10.2.2)',
    isComingSoon: false,
    features: [
      'Cloud AI Proxy: Toàn bộ API Key được mã hóa trên máy chủ bảo mật 100%',
      'Tự động chọn & xác nhận hộp Làm Rõ Ý Định khi chuyển câu hỏi',
      'Cơ chế Dual XHR/Fetch chống triệt để lỗi 429 Too Many Requests (25s backoff)',
      'Tự động phát hiện & khớp mẫu "Trả lời: [đáp án của bạn]" chuẩn AI EduNext',
      'Khóa nộp đơn nhất (Single Submit Lock) ngăn bão spam nút Nộp khi aria-pressed',
      'Bookmarklet 1-Click Zero-Install độc lập v10.2.2 (Không cần Tampermonkey)'
    ],
    plans: [
      { id: 'edunext-2h', duration: '2h', durationLabel: 'Trải Nghiệm (2 Tiếng)', price: 0, originalPrice: 20000, badge: 'Miễn Phí' },
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
    plans: [
      { id: 'khaothi-1w', duration: '1w', durationLabel: '1 Tuần (1 Đợt Thi)', price: 500000, originalPrice: 750000, isPopular: true, badge: 'Dự Kiến' },
      { id: 'khaothi-semester', duration: 'semester', durationLabel: '1 Kỳ Học (Toàn Bộ Môn)', price: 1200000, originalPrice: 1800000 }
    ],
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
    plans: [
      { 
        id: 'seb-1w', 
        duration: '1w', 
        durationLabel: '1 Tuần (+30% khi gia hạn)', 
        price: 900000, 
        originalPrice: 1200000, 
        isPopular: true, 
        badge: 'Dự Kiến',
        renewalNote: '+30% mỗi lần gia hạn tiếp theo'
      },
      { 
        id: 'seb-lifetime', 
        duration: 'lifetime', 
        durationLabel: 'Trọn Đời (Lifetime)', 
        price: 3000000, 
        originalPrice: 5000000, 
        badge: 'VIP Vĩnh Viễn',
        renewalNote: 'Dùng vĩnh viễn suốt các kỳ học FPT'
      }
    ],
    activeUsersCount: 0,
    rating: 5.0,
    accentColor: '#f59e0b'
  }
];

export const BANK_CONFIG = {
  bankId: 'MB', // MBBank
  bankName: 'Ngân hàng Quân Đội (MBBank)',
  accountNo: '0987654321',
  accountName: 'VO TRI KHANG',
  qrTemplate: 'compact2'
};
