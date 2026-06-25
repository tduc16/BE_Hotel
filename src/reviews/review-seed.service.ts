import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus, ReviewSource } from './entities/review.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Dữ liệu seed: 26 đánh giá thực tế của khách sạn Hoàng Minh
// Phân phối: 10 × ⭐⭐⭐⭐⭐ | 8 × ⭐⭐⭐⭐ | 5 × ⭐⭐⭐ | 2 × ⭐⭐ | 1 × ⭐
// ─────────────────────────────────────────────────────────────────────────────
const SEED_REVIEWS: Array<{
  reviewerName: string;
  rating: number;
  comment: string;
  roomType: string;
  stayPeriod: string;
  isFeatured: boolean;
  title?: string;
}> = [
  // ───── 5 SAO (10 đánh giá) ─────
  {
    reviewerName: 'Nguyễn Minh Tuấn',
    rating: 5,
    title: 'Kỳ nghỉ hoàn hảo cho cả gia đình',
    comment:
      'Gia đình tôi nghỉ 3 ngày 2 đêm tại đây, mọi thứ đều vượt quá kỳ vọng. Phòng VIP Suite rộng rãi, nội thất sang trọng, view nhìn ra thành phố cực đẹp. Nhân viên rất nhiệt tình, đặc biệt bữa sáng buffet phong phú và ngon. Bể bơi sạch, trẻ em rất thích. Sẽ quay lại lần sau.',
    roomType: 'VIP Suite',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: true,
  },
  {
    reviewerName: 'Lê Thị Mai',
    rating: 5,
    title: 'Không gian yên tĩnh, dịch vụ tuyệt vời',
    comment:
      'Khách sạn đẹp, không gian yên tĩnh, nhân viên lịch sự và chuyên nghiệp. Phòng Deluxe sạch bóng, được lau dọn kỹ lưỡng mỗi ngày. WiFi ổn định, điều hòa mát. Vị trí trung tâm, đi lại thuận tiện. Giá cả hợp lý so với chất lượng.',
    roomType: 'Deluxe Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: true,
  },
  {
    reviewerName: 'Phạm Hoàng Long',
    rating: 5,
    title: 'Trải nghiệm spa đỉnh cao',
    comment:
      'Đây là lần thứ ba tôi đặt phòng tại Hoàng Minh Hotel. Dịch vụ spa cực kỳ thư giãn, kỹ thuật viên tay nghề cao. Phòng Standard được cải tạo mới, nệm êm, chăn ga trắng tinh. Bãi đỗ xe rộng, miễn phí. Tôi đặc biệt ấn tượng với sự chăm chút từng chi tiết nhỏ của khách sạn.',
    roomType: 'Standard Room',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: true,
  },
  {
    reviewerName: 'Trần Ngọc Hà',
    rating: 5,
    title: 'Lựa chọn hoàn hảo cho tuần trăng mật',
    comment:
      'Tôi và chồng chọn Hoàng Minh Hotel cho tuần trăng mật. Suite được trang trí hoa tươi, champagne chào mừng — thật lãng mạn! Nhân viên hiểu tâm lý khách, phục vụ tận tình nhưng không gây phiền. Bữa sáng trên ban công với view thành phố là kỷ niệm khó quên nhất.',
    roomType: 'VIP Suite',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: true,
  },
  {
    reviewerName: 'Vũ Đức Thành',
    rating: 5,
    comment:
      'Check-in nhanh, thân thiện. Phòng thoáng, sạch, view tốt. Bể bơi tầng thượng rất tuyệt, nước trong vắt. Nhà hàng phục vụ đồ ăn ngon, đặc biệt món tôm nướng. Giá phòng Deluxe xứng đáng đồng tiền. Sẽ giới thiệu cho bạn bè.',
    roomType: 'Deluxe Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Nguyễn Thị Bích Vân',
    rating: 5,
    comment:
      'Khách sạn tuyệt vời! Phòng Standard nhỏ gọn nhưng đủ tiện nghi, rất hợp lý cho chuyến công tác một mình. WiFi cực mạnh, tôi làm việc từ xa rất tiện. Nhân viên lễ tân hỗ trợ tôi nhiệt tình khi gặp sự cố với chuyến bay. Sẽ quay lại.',
    roomType: 'Standard Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Đặng Quốc Hùng',
    rating: 5,
    comment:
      'Gia đình 5 người nghỉ Suite, phòng rộng rãi, đủ chỗ ngủ cho cả nhà. Trẻ em rất thích bể bơi và khu vui chơi mini. Bữa sáng buffet phong phú, trẻ em ăn miễn phí — đây là điểm cộng lớn! Vị trí trung tâm, đi shopping, ăn uống đều tiện.',
    roomType: 'VIP Suite',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Lương Thị Kim Oanh',
    rating: 5,
    comment:
      'Lần đầu đến Hoàng Minh, ấn tượng ngay từ sảnh đón khách sang trọng. Phòng Deluxe view nhìn ra hồ bơi rất đẹp. Nhân viên housekeeping lau dọn sạch sẽ, để lại mùi hương thơm dễ chịu. Nước nóng đủ, điều hòa êm. Dịch vụ 5 sao thực sự!',
    roomType: 'Deluxe Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Trương Văn Phúc',
    rating: 5,
    comment:
      'Khách sạn có vị trí đắc địa, gần trung tâm mua sắm và ẩm thực. Phòng sạch sẽ, giường êm, gối mềm vừa phải. Mỗi sáng thức dậy với buffet tuyệt vời — đủ từ món Á đến món Âu. Spa thư giãn sau chuyến du lịch dài. Toàn bộ trải nghiệm rất tốt.',
    roomType: 'Standard Room',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Mai Thị Hồng',
    rating: 5,
    comment:
      'Đặt phòng qua điện thoại, nhân viên tư vấn tận tình và chốt phòng nhanh. Khi đến, được nâng cấp phòng miễn phí — cảm giác được trân trọng. Phòng VIP Suite có bồn tắm jacuzzi, tôi ngâm mình sau ngày dài làm việc, tuyệt vời. Sẽ chọn đây là điểm dừng chân mỗi lần về quê.',
    roomType: 'VIP Suite',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },

  // ───── 4 SAO (8 đánh giá) ─────
  {
    reviewerName: 'Trần Văn Hoàng',
    rating: 4,
    title: 'View đẹp, dịch vụ tốt, giá hơi cao',
    comment:
      'View đẹp, dịch vụ tốt, nhân viên thân thiện. Phòng Deluxe trang trí hiện đại, tiện nghi đầy đủ. Chỉ có bữa sáng hơi ít món so với mong đợi và giá phòng cuối tuần khá cao. Bãi đỗ xe đôi khi hết chỗ. Tổng thể vẫn là lựa chọn tốt để nghỉ ngơi cuối tuần.',
    roomType: 'Deluxe Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Nguyễn Ngọc Anh',
    rating: 4,
    title: 'Phòng sạch, nhân viên thân thiện',
    comment:
      'Phòng sạch sẽ, nhân viên thân thiện và nhiệt tình. Bể bơi rộng, nước ấm vừa phải. WiFi tốt. Chỉ tiếc là thang máy đôi khi chờ khá lâu vào buổi sáng. Vị trí khá thuận tiện, gần các điểm ăn uống. Giá phòng Standard hợp lý.',
    roomType: 'Standard Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Bùi Thị Thanh Thủy',
    rating: 4,
    comment:
      'Khách sạn sang trọng, nhân viên chuyên nghiệp. Phòng VIP rộng và thoáng. Bữa sáng ngon, nhiều lựa chọn. Điểm trừ nhỏ là âm thanh từ tầng kế bên đôi lúc nghe được. Bãi đỗ xe đầy đủ, có camera an ninh. Nhìn chung rất hài lòng.',
    roomType: 'VIP Suite',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Đinh Văn Khoa',
    rating: 4,
    comment:
      'Check-in khá nhanh, nhân viên vui vẻ. Phòng Deluxe đẹp, sạch, view ra hồ bơi. Hồ bơi thoáng mát nhưng hơi đông vào cuối tuần. Nhà hàng phục vụ đồ ăn ngon, phần ăn vừa phải. Tổng thể là kỳ nghỉ dễ chịu, đáng tiền bỏ ra.',
    roomType: 'Deluxe Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Hồ Thị Huyền',
    rating: 4,
    comment:
      'Lưu trú 4 ngày 3 đêm với gia đình. Phòng Standard nhỏ hơn tôi mong đợi nhưng bù lại rất sạch và tiện nghi. Trẻ nhỏ được chào đón, nhân viên cho thêm gối và chăn. Bữa sáng trẻ em ăn thêm miễn phí. Spa thư giãn tốt. Chỉ cần thêm bãi đỗ xe.',
    roomType: 'Standard Room',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Lý Văn Đạt',
    rating: 4,
    comment:
      'Phòng Deluxe rộng, nội thất cao cấp. Nhân viên lịch sự. Bể bơi tầng thượng view cực đẹp nhưng đóng cửa sớm (20h). Bữa sáng phong phú nhưng cà phê pha hơi loãng. WiFi đôi lúc lag nhẹ. Tổng thể vẫn là kỳ nghỉ đáng nhớ.',
    roomType: 'Deluxe Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Ngô Thị Phương Linh',
    rating: 4,
    comment:
      'Đây là lần đầu tôi đặt phòng ở đây. Nhân viên check-in niềm nở, phòng sạch, view ra thành phố đêm rất đẹp. Điểm trừ nhỏ là minibar trong phòng hơi đắt. Tuy nhiên tổng thể rất hài lòng, sẽ cân nhắc quay lại vào dịp lễ.',
    roomType: 'Standard Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Phan Quốc Dũng',
    rating: 4,
    comment:
      'Khách sạn đáp ứng tốt cho chuyến công tác. Phòng Standard yên tĩnh, giường êm, không gian làm việc đủ tiện nghi. Bữa sáng phong phú, cà phê ngon. Đỗ xe miễn phí là điểm cộng. Nhân viên hỗ trợ in tài liệu khi tôi cần — rất chuyên nghiệp.',
    roomType: 'Standard Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },

  // ───── 3 SAO (5 đánh giá) ─────
  {
    reviewerName: 'Cao Thị Lan',
    rating: 3,
    comment:
      'Phòng sạch nhưng hơi nhỏ so với giá. WiFi ổn. Bữa sáng ít lựa chọn hơn quảng cáo. Nhân viên lúc bận thì phục vụ hơi chậm. Vị trí tốt, gần trung tâm. Tạm được cho một đêm ngắn.',
    roomType: 'Standard Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Dương Văn Tùng',
    rating: 3,
    comment:
      'Phòng Deluxe đẹp nhưng điều hòa bị ồn, ngủ không ngon giấc. Nhân viên kỹ thuật xử lý ngay khi tôi phản ánh — điểm cộng. Bễ bơi ổn. Giá hơi nhỉnh so với chất lượng thực tế. Mong phía khách sạn kiểm tra lại thiết bị phòng.',
    roomType: 'Deluxe Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Lê Thị Mỹ Duyên',
    rating: 3,
    comment:
      'Kỳ nghỉ ổn nhưng không như kỳ vọng. Phòng Standard sạch nhưng rèm che không kín hoàn toàn, ánh đèn đường lọt vào gây khó ngủ. Bữa sáng hạn chế món. Nhân viên thân thiện. Sẽ thử lại nếu giá được điều chỉnh hợp lý hơn.',
    roomType: 'Standard Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Phùng Văn Minh',
    rating: 3,
    comment:
      'Địa điểm tốt. Phòng VIP có bồn tắm nhưng vòi sen áp lực yếu. Giường êm, khăn trải giường thơm. Nhân viên lễ tân chuyên nghiệp. Nhà hàng đóng cửa sớm nên tôi phải ra ngoài ăn tối. Có thể cải thiện thêm giờ mở cửa.',
    roomType: 'VIP Suite',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Trịnh Thị Lan Anh',
    rating: 3,
    comment:
      'Chất lượng tạm được. Phòng Deluxe sạch, view khá đẹp. Bữa sáng ổn. Điểm trừ là thang máy chờ lâu vào giờ cao điểm và không gian sảnh đôi khi đông đúc. Bãi đỗ xe hơi xa phòng. Giá cũng khá, mong khách sạn cải thiện thêm.',
    roomType: 'Deluxe Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },

  // ───── 2 SAO (2 đánh giá) ─────
  {
    reviewerName: 'Hoàng Văn Bình',
    rating: 2,
    comment:
      'Phòng không sạch như ảnh quảng cáo. Thảm có vết bẩn, tôi phải yêu cầu đổi phòng. Nhân viên giải quyết chậm, mất gần 2 tiếng mới được chuyển phòng. Điều hòa yếu. Bữa sáng bình thường. Với mức giá này, tôi kỳ vọng cao hơn nhiều.',
    roomType: 'Standard Room',
    stayPeriod: '2 ngày 1 đêm',
    isFeatured: false,
  },
  {
    reviewerName: 'Nguyễn Thị Như Quỳnh',
    rating: 2,
    comment:
      'Đặt phòng Deluxe nhưng được xếp phòng view kém hơn, không đúng theo yêu cầu khi đặt. Nhân viên không chủ động xin lỗi, tôi phải hỏi nhiều lần. WiFi tầng 3 rất chậm. Bữa sáng hết đồ nhanh, không được bổ sung kịp thời. Cần cải thiện nhiều.',
    roomType: 'Deluxe Room',
    stayPeriod: '3 ngày 2 đêm',
    isFeatured: false,
  },

  // ───── 1 SAO (1 đánh giá) ─────
  {
    reviewerName: 'Lâm Chí Cường',
    rating: 1,
    comment:
      'Thất vọng hoàn toàn. Đặt VIP Suite giá cao nhưng phòng có mùi ẩm. Điều hòa hỏng và phải chờ 3 tiếng mới được sửa. Nhân viên không xin lỗi, thái độ thờ ơ. Bể bơi đóng cửa không thông báo trước. Yêu cầu hoàn tiền không được giải quyết thỏa đáng. Không quay lại.',
    roomType: 'VIP Suite',
    stayPeriod: '4 ngày 3 đêm',
    isFeatured: false,
  },
];

@Injectable()
export class ReviewSeedService implements OnModuleInit {
  private readonly logger = new Logger(ReviewSeedService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async onModuleInit() {
    await this.seedReviews();
  }

  async seedReviews(): Promise<void> {
    try {
      // Kiểm tra xem đã có seeded reviews chưa
      const existingCount = await this.reviewRepo.count({
        where: { source: ReviewSource.SEEDED },
      });

      if (existingCount > 0) {
        this.logger.log(
          `Seed đánh giá đã tồn tại (${existingCount} reviews). Bỏ qua.`,
        );
        return;
      }

      this.logger.log('Đang seed 26 đánh giá thực tế...');

      // Tạo ngày seed trải đều trong 6 tháng gần đây
      const now = new Date();
      const reviews = SEED_REVIEWS.map((data, index) => {
        const daysAgo = Math.floor((index / SEED_REVIEWS.length) * 180) + 5;
        const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        const review = this.reviewRepo.create({
          reviewerName: data.reviewerName,
          rating: data.rating,
          comment: data.comment,
          title: data.title ?? null,
          roomType: data.roomType,
          stayPeriod: data.stayPeriod,
          isFeatured: data.isFeatured,
          source: ReviewSource.SEEDED,
          status: ReviewStatus.APPROVED,
          // Các trường không cần thiết cho seeded reviews
          bookingId: null,
          customerId: null,
          roomCategoryId: null,
          roomId: null,
          images: null,
          adminReply: null,
          adminReplyAt: null,
          repliedByAdminId: null,
          rejectReason: null,
        });

        // Gán thủ công createdAt (TypeORM tự set khi save, cần dùng queryBuilder để ghi đè)
        (review as any).createdAt = createdAt;

        return review;
      });

      // Lưu từng batch để tránh timeout
      const BATCH_SIZE = 10;
      for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
        const batch = reviews.slice(i, i + BATCH_SIZE);
        await this.reviewRepo.save(batch);
      }

      // Cập nhật createdAt thực tế cho từng review (vì TypeORM override bằng DEFAULT now())
      for (let i = 0; i < SEED_REVIEWS.length; i++) {
        const daysAgo = Math.floor((i / SEED_REVIEWS.length) * 180) + 5;
        const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const reviewerName = SEED_REVIEWS[i].reviewerName;

        await this.reviewRepo
          .createQueryBuilder()
          .update(Review)
          .set({ createdAt })
          .where('reviewer_name = :name AND source = :source', {
            name: reviewerName,
            source: ReviewSource.SEEDED,
          })
          .execute();
      }

      this.logger.log(`✅ Đã seed thành công ${SEED_REVIEWS.length} đánh giá.`);
    } catch (error) {
      this.logger.error('❌ Lỗi khi seed đánh giá:', error);
    }
  }
}
