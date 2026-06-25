-- Seed 26 đánh giá thực tế cho Hoàng Minh Hotel
-- Chỉ insert nếu chưa có seeded reviews

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM reviews WHERE source = 'SEEDED') = 0 THEN

    -- 5 SAO (10 đánh giá)
    INSERT INTO reviews (id, booking_id, customer_id, reviewer_name, rating, title, comment, room_type, stay_period, source, status, is_featured, created_at, updated_at)
    VALUES
      (uuid_generate_v4(), NULL, NULL, 'Nguyễn Minh Tuấn', 5, 'Kỳ nghỉ hoàn hảo cho cả gia đình', 'Gia đình tôi nghỉ 3 ngày 2 đêm tại đây, mọi thứ đều vượt quá kỳ vọng. Phòng VIP Suite rộng rãi, nội thất sang trọng, view nhìn ra thành phố cực đẹp. Nhân viên rất nhiệt tình, đặc biệt bữa sáng buffet phong phú và ngon. Bể bơi sạch, trẻ em rất thích. Sẽ quay lại lần sau.', 'VIP Suite', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', true, NOW() - INTERVAL '175 days', NOW() - INTERVAL '175 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Lê Thị Mai', 5, 'Không gian yên tĩnh, dịch vụ tuyệt vời', 'Khách sạn đẹp, không gian yên tĩnh, nhân viên lịch sự và chuyên nghiệp. Phòng Deluxe sạch bóng, được lau dọn kỹ lưỡng mỗi ngày. WiFi ổn định, điều hòa mát. Vị trí trung tâm, đi lại thuận tiện. Giá cả hợp lý so với chất lượng.', 'Deluxe Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', true, NOW() - INTERVAL '165 days', NOW() - INTERVAL '165 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Phạm Hoàng Long', 5, 'Trải nghiệm spa đỉnh cao', 'Đây là lần thứ ba tôi đặt phòng tại Hoàng Minh Hotel. Dịch vụ spa cực kỳ thư giãn, kỹ thuật viên tay nghề cao. Phòng Standard được cải tạo mới, nệm êm, chăn ga trắng tinh. Bãi đỗ xe rộng, miễn phí. Tôi đặc biệt ấn tượng với sự chăm chút từng chi tiết nhỏ của khách sạn.', 'Standard Room', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', true, NOW() - INTERVAL '155 days', NOW() - INTERVAL '155 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Trần Ngọc Hà', 5, 'Lựa chọn hoàn hảo cho tuần trăng mật', 'Tôi và chồng chọn Hoàng Minh Hotel cho tuần trăng mật. Suite được trang trí hoa tươi, champagne chào mừng — thật lãng mạn! Nhân viên hiểu tâm lý khách, phục vụ tận tình nhưng không gây phiền. Bữa sáng trên ban công với view thành phố là kỷ niệm khó quên nhất.', 'VIP Suite', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', true, NOW() - INTERVAL '145 days', NOW() - INTERVAL '145 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Vũ Đức Thành', 5, NULL, 'Check-in nhanh, thân thiện. Phòng thoáng, sạch, view tốt. Bể bơi tầng thượng rất tuyệt, nước trong vắt. Nhà hàng phục vụ đồ ăn ngon, đặc biệt món tôm nướng. Giá phòng Deluxe xứng đáng đồng tiền. Sẽ giới thiệu cho bạn bè.', 'Deluxe Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '135 days', NOW() - INTERVAL '135 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Nguyễn Thị Bích Vân', 5, NULL, 'Khách sạn tuyệt vời! Phòng Standard nhỏ gọn nhưng đủ tiện nghi, rất hợp lý cho chuyến công tác một mình. WiFi cực mạnh, tôi làm việc từ xa rất tiện. Nhân viên lễ tân hỗ trợ tôi nhiệt tình khi gặp sự cố với chuyến bay. Sẽ quay lại.', 'Standard Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '125 days', NOW() - INTERVAL '125 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Đặng Quốc Hùng', 5, NULL, 'Gia đình 5 người nghỉ Suite, phòng rộng rãi, đủ chỗ ngủ cho cả nhà. Trẻ em rất thích bể bơi và khu vui chơi mini. Bữa sáng buffet phong phú, trẻ em ăn miễn phí — đây là điểm cộng lớn! Vị trí trung tâm, đi shopping, ăn uống đều tiện.', 'VIP Suite', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '115 days', NOW() - INTERVAL '115 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Lương Thị Kim Oanh', 5, NULL, 'Lần đầu đến Hoàng Minh, ấn tượng ngay từ sảnh đón khách sang trọng. Phòng Deluxe view nhìn ra hồ bơi rất đẹp. Nhân viên housekeeping lau dọn sạch sẽ, để lại mùi hương thơm dễ chịu. Nước nóng đủ, điều hòa êm. Dịch vụ 5 sao thực sự!', 'Deluxe Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '105 days', NOW() - INTERVAL '105 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Trương Văn Phúc', 5, NULL, 'Khách sạn có vị trí đắc địa, gần trung tâm mua sắm và ẩm thực. Phòng sạch sẽ, giường êm, gối mềm vừa phải. Mỗi sáng thức dậy với buffet tuyệt vời — đủ từ món Á đến món Âu. Spa thư giãn sau chuyến du lịch dài. Toàn bộ trải nghiệm rất tốt.', 'Standard Room', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '95 days', NOW() - INTERVAL '95 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Mai Thị Hồng', 5, NULL, 'Đặt phòng qua điện thoại, nhân viên tư vấn tận tình và chốt phòng nhanh. Khi đến, được nâng cấp phòng miễn phí — cảm giác được trân trọng. Phòng VIP Suite có bồn tắm jacuzzi, tôi ngâm mình sau ngày dài làm việc, tuyệt vời. Sẽ chọn đây là điểm dừng chân mỗi lần về quê.', 'VIP Suite', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '85 days', NOW() - INTERVAL '85 days'),
      
      -- 4 SAO (8 đánh giá)
      (uuid_generate_v4(), NULL, NULL, 'Trần Văn Hoàng', 4, 'View đẹp, dịch vụ tốt, giá hơi cao', 'View đẹp, dịch vụ tốt, nhân viên thân thiện. Phòng Deluxe trang trí hiện đại, tiện nghi đầy đủ. Chỉ có bữa sáng hơi ít món so với mong đợi và giá phòng cuối tuần khá cao. Bãi đỗ xe đôi khi hết chỗ. Tổng thể vẫn là lựa chọn tốt để nghỉ ngơi cuối tuần.', 'Deluxe Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '78 days', NOW() - INTERVAL '78 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Nguyễn Ngọc Anh', 4, 'Phòng sạch, nhân viên thân thiện', 'Phòng sạch sẽ, nhân viên thân thiện và nhiệt tình. Bể bơi rộng, nước ấm vừa phải. WiFi tốt. Chỉ tiếc là thang máy đôi khi chờ khá lâu vào buổi sáng. Vị trí khá thuận tiện, gần các điểm ăn uống. Giá phòng Standard hợp lý.', 'Standard Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '71 days', NOW() - INTERVAL '71 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Bùi Thị Thanh Thủy', 4, NULL, 'Khách sạn sang trọng, nhân viên chuyên nghiệp. Phòng VIP rộng và thoáng. Bữa sáng ngon, nhiều lựa chọn. Điểm trừ nhỏ là âm thanh từ tầng kế bên đôi lúc nghe được. Bãi đỗ xe đầy đủ, có camera an ninh. Nhìn chung rất hài lòng.', 'VIP Suite', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '64 days', NOW() - INTERVAL '64 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Đinh Văn Khoa', 4, NULL, 'Check-in khá nhanh, nhân viên vui vẻ. Phòng Deluxe đẹp, sạch, view ra hồ bơi. Hồ bơi thoáng mát nhưng hơi đông vào cuối tuần. Nhà hàng phục vụ đồ ăn ngon, phần ăn vừa phải. Tổng thể là kỳ nghỉ dễ chịu, đáng tiền bỏ ra.', 'Deluxe Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '57 days', NOW() - INTERVAL '57 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Hồ Thị Huyền', 4, NULL, 'Lưu trú 4 ngày 3 đêm với gia đình. Phòng Standard nhỏ hơn tôi mong đợi nhưng bù lại rất sạch và tiện nghi. Trẻ nhỏ được chào đón, nhân viên cho thêm gối và chăn. Bữa sáng trẻ em ăn thêm miễn phí. Spa thư giãn tốt. Chỉ cần thêm bãi đỗ xe.', 'Standard Room', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Lý Văn Đạt', 4, NULL, 'Phòng Deluxe rộng, nội thất cao cấp. Nhân viên lịch sự. Bể bơi tầng thượng view cực đẹp nhưng đóng cửa sớm (20h). Bữa sáng phong phú nhưng cà phê pha hơi loãng. WiFi đôi lúc lag nhẹ. Tổng thể vẫn là kỳ nghỉ đáng nhớ.', 'Deluxe Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '43 days', NOW() - INTERVAL '43 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Ngô Thị Phương Linh', 4, NULL, 'Đây là lần đầu tôi đặt phòng ở đây. Nhân viên check-in niềm nở, phòng sạch, view ra thành phố đêm rất đẹp. Điểm trừ nhỏ là minibar trong phòng hơi đắt. Tuy nhiên tổng thể rất hài lòng, sẽ cân nhắc quay lại vào dịp lễ.', 'Standard Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '36 days', NOW() - INTERVAL '36 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Phan Quốc Dũng', 4, NULL, 'Khách sạn đáp ứng tốt cho chuyến công tác. Phòng Standard yên tĩnh, giường êm, không gian làm việc đủ tiện nghi. Bữa sáng phong phú, cà phê ngon. Đỗ xe miễn phí là điểm cộng. Nhân viên hỗ trợ in tài liệu khi tôi cần — rất chuyên nghiệp.', 'Standard Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '29 days', NOW() - INTERVAL '29 days'),
      
      -- 3 SAO (5 đánh giá)
      (uuid_generate_v4(), NULL, NULL, 'Cao Thị Lan', 3, NULL, 'Phòng sạch nhưng hơi nhỏ so với giá. WiFi ổn. Bữa sáng ít lựa chọn hơn quảng cáo. Nhân viên lúc bận thì phục vụ hơi chậm. Vị trí tốt, gần trung tâm. Tạm được cho một đêm ngắn.', 'Standard Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Dương Văn Tùng', 3, NULL, 'Phòng Deluxe đẹp nhưng điều hòa bị ồn, ngủ không ngon giấc. Nhân viên kỹ thuật xử lý ngay khi tôi phản ánh — điểm cộng. Bể bơi ổn. Giá hơi nhỉnh so với chất lượng thực tế. Mong phía khách sạn kiểm tra lại thiết bị phòng.', 'Deluxe Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Lê Thị Mỹ Duyên', 3, NULL, 'Kỳ nghỉ ổn nhưng không như kỳ vọng. Phòng Standard sạch nhưng rèm che không kín hoàn toàn, ánh đèn đường lọt vào gây khó ngủ. Bữa sáng hạn chế món. Nhân viên thân thiện. Sẽ thử lại nếu giá được điều chỉnh hợp lý hơn.', 'Standard Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Phùng Văn Minh', 3, NULL, 'Địa điểm tốt. Phòng VIP có bồn tắm nhưng vòi sen áp lực yếu. Giường êm, khăn trải giường thơm. Nhân viên lễ tân chuyên nghiệp. Nhà hàng đóng cửa sớm nên tôi phải ra ngoài ăn tối. Có thể cải thiện thêm giờ mở cửa.', 'VIP Suite', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Trịnh Thị Lan Anh', 3, NULL, 'Chất lượng tạm được. Phòng Deluxe sạch, view khá đẹp. Bữa sáng ổn. Điểm trừ là thang máy chờ lâu vào giờ cao điểm và không gian sảnh đôi khi đông đúc. Bãi đỗ xe hơi xa phòng. Giá cũng khá, mong khách sạn cải thiện thêm.', 'Deluxe Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
      
      -- 2 SAO (2 đánh giá)
      (uuid_generate_v4(), NULL, NULL, 'Hoàng Văn Bình', 2, NULL, 'Phòng không sạch như ảnh quảng cáo. Thảm có vết bẩn, tôi phải yêu cầu đổi phòng. Nhân viên giải quyết chậm, mất gần 2 tiếng mới được chuyển phòng. Điều hòa yếu. Bữa sáng bình thường. Với mức giá này, tôi kỳ vọng cao hơn nhiều.', 'Standard Room', '2 ngày 1 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
      
      (uuid_generate_v4(), NULL, NULL, 'Nguyễn Thị Như Quỳnh', 2, NULL, 'Đặt phòng Deluxe nhưng được xếp phòng view kém hơn, không đúng theo yêu cầu khi đặt. Nhân viên không chủ động xin lỗi, tôi phải hỏi nhiều lần. WiFi tầng 3 rất chậm. Bữa sáng hết đồ nhanh, không được bổ sung kịp thời. Cần cải thiện nhiều.', 'Deluxe Room', '3 ngày 2 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
      
      -- 1 SAO (1 đánh giá)
      (uuid_generate_v4(), NULL, NULL, 'Lâm Chí Cường', 1, NULL, 'Thất vọng hoàn toàn. Đặt VIP Suite giá cao nhưng phòng có mùi ẩm. Điều hòa hỏng và phải chờ 3 tiếng mới được sửa. Nhân viên không xin lỗi, thái độ thờ ơ. Bể bơi đóng cửa không thông báo trước. Yêu cầu hoàn tiền không được giải quyết thỏa đáng. Không quay lại.', 'VIP Suite', '4 ngày 3 đêm', 'SEEDED', 'APPROVED', false, NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days');

    RAISE NOTICE 'Đã seed 26 đánh giá thành công.';
  ELSE
    RAISE NOTICE 'Seeded reviews đã tồn tại, bỏ qua.';
  END IF;
END $$;
