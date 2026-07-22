// Du lieu bai viet "Kinh nghiem cham xe" - dung chung cho ca the (card) o
// trang chu (MaintenanceTips.jsx) va trang chi tiet (kinh-nghiem/[slug]).
export const maintenanceTips = [
  {
    slug: "kiem-tra-xe-co-ban",
    icon: "ClipboardCheck",
    tag: "Kiểm tra định kỳ",
    title: "Kiểm tra xe cơ bản trước mỗi chuyến đi",
    excerpt:
      "4 điểm nên xem trong 5 phút: mức dầu nhớt, áp suất lốp (kể cả lốp dự phòng), hệ thống đèn xe, và mực nước làm mát - giúp phát hiện sớm trước khi thành sự cố lớn.",
    readTime: "6 phút đọc",
    intro:
      "Chỉ mất khoảng 5 phút trước mỗi chuyến đi xa, việc kiểm tra nhanh các hạng mục dưới đây giúp bạn phát hiện sớm những dấu hiệu bất thường - trước khi chúng trở thành sự cố giữa đường hoặc hư hỏng tốn kém hơn.",
    sections: [
      {
        heading: "1. Mức dầu động cơ",
        paragraphs: [
          "Đỗ xe trên mặt phẳng, tắt máy và chờ khoảng 5-10 phút để dầu chảy về đáy các-te trước khi kiểm tra. Rút que thăm dầu, lau sạch, cắm lại hết cỡ rồi rút ra lần nữa để đọc mức dầu.",
        ],
        list: [
          "Mức dầu nên nằm giữa vạch MIN và MAX trên que thăm.",
          "Dầu có màu nâu đen bình thường là dấu hiệu đã qua sử dụng nhưng vẫn dùng được; dầu sánh đặc, có mùi khét hoặc lẫn cặn kim loại thì nên thay sớm.",
          "Nếu phải châm dầu liên tục qua các lần kiểm tra, xe có thể đang hao dầu bất thường - nên mang đến gara kiểm tra.",
        ],
      },
      {
        heading: "2. Áp suất lốp (kể cả lốp dự phòng)",
        paragraphs: [
          "Chỉ số áp suất khuyến nghị của nhà sản xuất thường được dán ở khung cửa bên ghế lái (mở cửa ra là thấy), không phải con số in trên thành lốp.",
          "Nên đo áp suất lúc lốp còn nguội (xe chưa chạy hoặc chạy dưới 2km) để có kết quả chính xác nhất.",
        ],
        list: [
          "Lốp non hơi làm xe hao xăng hơn và mòn lốp không đều.",
          "Đừng quên lốp dự phòng - nhiều người chỉ phát hiện lốp dự phòng bị xẹp đúng lúc cần dùng đến.",
          "Quan sát luôn bề mặt lốp: gai lốp mòn tới chỉ báo, phồng rộp hoặc nứt chân chim nên thay mới.",
        ],
      },
      {
        heading: "3. Hệ thống đèn xe",
        paragraphs: [
          "Nhờ người đứng ngoài quan sát hoặc đỗ sát tường/kính để thấy phản chiếu khi bật lần lượt từng loại đèn.",
        ],
        list: [
          "Đèn pha, đèn cốt, đèn hậu, đèn phanh, đèn xi-nhan 2 bên và đèn lùi.",
          "Đèn phanh thường bị bỏ sót nhất vì tài xế không tự nhìn thấy được khi ngồi trong xe.",
        ],
      },
      {
        heading: "4. Nước làm mát & nước rửa kính",
        paragraphs: [
          "Kiểm tra mực nước làm mát ở bình phụ (nằm ngoài, có vạch MIN/MAX) khi động cơ đã nguội - tuyệt đối không mở nắp két nước khi máy còn nóng.",
          "Châm thêm nước rửa kính nếu gần hết, đặc biệt hữu ích khi đi đường xa nhiều bụi hoặc côn trùng bám kính.",
        ],
      },
      {
        heading: "5. Phanh tay & bàn đạp phanh",
        paragraphs: [
          "Kéo phanh tay cảm nhận độ ăn, đạp thử bàn đạp phanh xem có bị hẫng, lún sâu bất thường hay phát ra tiếng kêu lạ không trước khi khởi hành.",
        ],
      },
    ],
    callout: {
      title: "Khi nào nên mang xe đến gara ngay?",
      text: "Nếu phát hiện dầu hao bất thường, lốp mòn không đều, đèn nào đó không sáng, hoặc bàn đạp phanh có cảm giác khác lạ - nên mang xe đến AutoGara kiểm tra trước khi đi đường dài, thay vì tự xử lý tạm thời.",
    },
  },
  {
    slug: "den-check-engine-sang",
    icon: "AlertTriangle",
    tag: "Sự cố thường gặp",
    title: "Đèn Check Engine sáng - có đáng lo?",
    excerpt:
      "Đèn sáng liên tục thường là lỗi cảm biến hoặc nắp bình xăng chưa đóng chặt, có thể chạy tiếp và mang xe đi kiểm tra sớm. Đèn nhấp nháy là dấu hiệu khẩn cấp - nên dừng xe và gọi gara ngay.",
    readTime: "5 phút đọc",
    intro:
      "Đèn Check Engine (đèn báo lỗi động cơ) là một trong những đèn cảnh báo khiến nhiều tài xế lo lắng nhất vì nó có thể báo hiệu từ một lỗi rất nhỏ đến một sự cố nghiêm trọng. Điều quan trọng là phân biệt được mức độ khẩn cấp qua cách đèn sáng.",
    sections: [
      {
        heading: "Đèn sáng liên tục (ổn định)",
        paragraphs: [
          "Đây là mức cảnh báo nhẹ hơn - xe vẫn có thể vận hành bình thường trong thời gian ngắn. Nguyên nhân phổ biến nhất và vô hại nhất là nắp bình xăng chưa vặn chặt hoặc bị lỏng ren, khiến hệ thống kiểm soát khí thải báo lỗi.",
        ],
        list: [
          "Nắp bình xăng vặn chưa chặt hoặc gioăng nắp bị chai.",
          "Cảm biến oxy (oxygen sensor) hoạt động kém chính xác.",
          "Bugi hoặc bô-bin đánh lửa xuống cấp theo thời gian sử dụng.",
          "Bộ lọc khí thải (catalytic converter) hoạt động kém hiệu quả.",
        ],
      },
      {
        heading: "Đèn nhấp nháy liên tục",
        paragraphs: [
          "Đây là dấu hiệu khẩn cấp, thường liên quan đến hiện tượng động cơ bỏ máy (misfire) nghiêm trọng - nhiên liệu chưa cháy hết bị đẩy vào bộ lọc khí thải, có thể gây hư hỏng nặng và tốn kém nếu tiếp tục vận hành.",
        ],
        list: [
          "Nên giảm tốc độ, tấp vào lề an toàn và tắt máy ngay khi có thể.",
          "Gọi cứu hộ hoặc gara thay vì cố gắng lái tiếp đến điểm sửa xe.",
        ],
      },
      {
        heading: "Xử lý tạm thời khi phát hiện đèn sáng",
        list: [
          "Kiểm tra và vặn chặt lại nắp bình xăng, đèn có thể tự tắt sau vài chu kỳ khởi động nếu đây đúng là nguyên nhân.",
          "Quan sát thêm các biểu hiện đi kèm: xe có bị giật, ì máy, hao xăng bất thường hay có mùi lạ không.",
          "Không nên tự xoá lỗi khi chưa xác định nguyên nhân - việc này chỉ tắt đèn tạm thời mà không khắc phục lỗi gốc.",
        ],
      },
      {
        heading: "AutoGara xử lý như thế nào?",
        paragraphs: [
          "Khi mang xe đến, kỹ thuật viên sẽ dùng máy chẩn đoán OBD-II để đọc chính xác mã lỗi đang được ghi nhận trong hệ thống điều khiển động cơ (ECU), từ đó xác định đúng nguyên nhân thay vì đoán mò - tránh thay đúng linh kiện không hỏng, tốn kém oan cho khách hàng.",
        ],
      },
    ],
    callout: {
      title: "Ghi nhớ",
      text: "Đèn sáng ổn định: có thể chạy tiếp nhưng nên kiểm tra sớm trong vài ngày tới. Đèn nhấp nháy: dừng xe an toàn và liên hệ gara ngay, tránh lái tiếp để không gây hư hỏng lan rộng.",
    },
  },
  {
    slug: "phanh-keu-la",
    icon: "Disc3",
    tag: "Sự cố thường gặp",
    title: "Phanh phát tiếng kêu ken két lạ",
    excerpt:
      "Thường do má phanh mòn tới vạch báo hoặc đĩa phanh bị bám bụi/rỉ nhẹ sau mưa. Nếu kèm rung vô-lăng hoặc phanh ăn không đều, nên mang xe kiểm tra trong 1-2 ngày tới.",
    readTime: "5 phút đọc",
    intro:
      "Tiếng kêu lạ khi phanh là một trong những dấu hiệu dễ nhận biết nhất nhưng cũng dễ bị bỏ qua nhất, vì xe vẫn phanh được bình thường. Phân biệt đúng loại tiếng kêu giúp bạn đánh giá được mức độ cần xử lý.",
    sections: [
      {
        heading: "Tiếng rít cao, đều đặn khi đạp phanh",
        paragraphs: [
          "Đây thường là âm thanh cố ý từ một lá kim loại nhỏ (wear indicator) gắn trên má phanh - nhà sản xuất thiết kế để phát ra tiếng rít khi má phanh mòn gần tới giới hạn, nhắc tài xế mang xe đi kiểm tra trước khi mòn hết hoàn toàn.",
        ],
      },
      {
        heading: "Tiếng ken két, cọ xát kim loại",
        paragraphs: [
          "Nếu tiếng kêu nghe nặng và như kim loại cọ vào nhau, khả năng cao má phanh đã mòn hết hoàn toàn, phần kim loại của guốc phanh đang cọ trực tiếp vào đĩa phanh - cần thay má phanh gấp để tránh làm hỏng luôn cả đĩa phanh.",
        ],
      },
      {
        heading: "Tiếng kêu chỉ xuất hiện sau mưa hoặc để xe qua đêm",
        paragraphs: [
          "Thường do một lớp rỉ sét mỏng hình thành trên bề mặt đĩa phanh sau khi bị ẩm ướt qua đêm. Hiện tượng này thường tự hết sau vài lần đạp phanh đầu tiên khi lớp rỉ mỏng bị má phanh mài sạch, không đáng lo ngại.",
        ],
      },
      {
        heading: "Dấu hiệu cần dừng xe kiểm tra ngay",
        list: [
          "Vô-lăng hoặc bàn đạp phanh bị rung khi phanh.",
          "Xe bị lệch sang một bên khi đạp phanh.",
          "Bàn đạp phanh bị hẫng, phải đạp sâu hơn bình thường mới ăn.",
          "Có mùi khét rõ rệt sau khi phanh gấp hoặc đi đường đèo dốc dài.",
        ],
      },
      {
        heading: "Kiểm tra nhanh tại nhà",
        paragraphs: [
          "Nếu bánh xe có thiết kế mâm hở, bạn có thể quan sát trực tiếp độ dày má phanh qua khe nan hoa: má phanh còn dày và đều là ổn, mỏng dưới khoảng 3mm nên thay sớm.",
        ],
      },
    ],
    callout: {
      title: "Đừng chủ quan",
      text: "Tiếng kêu khi phanh không tự hết sau vài ngày, hoặc đi kèm rung/lệch xe, nên mang xe đến AutoGara kiểm tra trong 1-2 ngày tới - hệ thống phanh liên quan trực tiếp đến an toàn, không nên trì hoãn.",
    },
  },
  {
    slug: "dieu-hoa-khong-mat",
    icon: "Snowflake",
    tag: "Sự cố thường gặp",
    title: "Điều hoà ô tô không mát hoặc mát yếu",
    excerpt:
      "Nguyên nhân thường gặp nhất là thiếu gas lạnh do rò rỉ, dàn lạnh bị bám bẩn hoặc lọc gió điều hoà tắc nghẽn. Nghe tiếng lạ khi bật cốc-lơ là dấu hiệu cần kiểm tra ngay.",
    readTime: "5 phút đọc",
    intro:
      "Điều hoà không mát là than phiền phổ biến nhất mỗi khi vào mùa hè, đặc biệt với xe đã sử dụng trên 3-4 năm. Phần lớn nguyên nhân đều liên quan đến gas lạnh hoặc bụi bẩn tích tụ, có thể xử lý nhanh nếu phát hiện sớm.",
    sections: [
      {
        heading: "Thiếu gas lạnh do rò rỉ",
        paragraphs: [
          "Đây là nguyên nhân phổ biến nhất - hệ thống lạnh là mạch kín, gas không tự hao hụt trừ khi có điểm rò rỉ ở gioăng, ống dẫn hoặc lốc lạnh. Xe càng lâu năm, gioăng cao su càng dễ lão hoá và rò rỉ chậm.",
        ],
        list: [
          "Dấu hiệu: hơi lạnh yếu dần theo thời gian, phải bật quạt tối đa mới cảm nhận được mát.",
          "Nạp gas mà không tìm điểm rò rỉ chỉ là giải pháp tạm thời, vài tháng sau sẽ hết mát trở lại.",
        ],
      },
      {
        heading: "Dàn lạnh và lọc gió điều hoà bị bẩn",
        paragraphs: [
          "Bụi mịn và nấm mốc tích tụ trên dàn lạnh (giàn bay hơi) sau thời gian dài sử dụng làm giảm khả năng trao đổi nhiệt, đồng thời gây mùi hôi khó chịu khi bật điều hoà.",
        ],
        list: [
          "Nên vệ sinh dàn lạnh và thay lọc gió điều hoà định kỳ mỗi 15.000-20.000km.",
          "Mùi ẩm mốc khi mới bật điều hoà là dấu hiệu rõ nhất của dàn lạnh bị bẩn.",
        ],
      },
      {
        heading: "Lốc lạnh (máy nén) hoạt động kém hoặc có tiếng lạ",
        paragraphs: [
          "Nếu nghe tiếng kêu lạch cạch hoặc rít khi bật điều hoà, có thể lốc lạnh bị thiếu dầu bôi trơn hoặc dây curoa dẫn động bị chùng, mòn.",
        ],
        list: [
          "Không nên tiếp tục sử dụng nếu có tiếng kêu bất thường - lốc lạnh hỏng nặng sẽ tốn kém hơn nhiều so với bảo dưỡng sớm.",
        ],
      },
      {
        heading: "Kiểm tra nhanh tại nhà",
        list: [
          "Bật điều hoà ở mức lạnh nhất, quạt tối đa, cảm nhận độ lạnh ở cửa gió sau khoảng 3-5 phút.",
          "Quan sát xem có tiếng kêu lạ hoặc mùi hôi bất thường khi vừa bật điều hoà không.",
        ],
      },
    ],
    callout: {
      title: "Nên bảo dưỡng điều hoà định kỳ",
      text: "Kiểm tra gas lạnh và vệ sinh dàn lạnh mỗi năm 1 lần (kể cả khi chưa yếu hẳn) giúp điều hoà luôn mát sâu và tránh phải sửa chữa lớn khi lốc lạnh đã hỏng nặng.",
    },
  },
  {
    slug: "volang-rung-toc-do-cao",
    icon: "Activity",
    tag: "Sự cố thường gặp",
    title: "Vô-lăng bị rung khi chạy tốc độ cao",
    excerpt:
      "Thường do lốp/mâm mất cân bằng động hoặc lốp mòn không đều. Nếu rung tăng dần theo tốc độ và kèm lệch lái, nên kiểm tra cân bằng lốp và hệ thống lái trong thời gian sớm.",
    readTime: "5 phút đọc",
    intro:
      "Rung vô-lăng khi chạy nhanh (thường từ 80km/h trở lên) là dấu hiệu khá phổ biến nhưng dễ bị bỏ qua vì không ảnh hưởng ngay đến khả năng vận hành. Tuy nhiên đây thường là tín hiệu sớm của vấn đề ở lốp hoặc hệ thống lái/treo.",
    sections: [
      {
        heading: "Lốp và mâm mất cân bằng động",
        paragraphs: [
          "Đây là nguyên nhân phổ biến nhất - sau một thời gian sử dụng hoặc sau khi thay lốp mới, các viên chì cân bằng có thể bị lệch hoặc rơi ra, khiến bánh xe quay không đều ở tốc độ cao.",
        ],
        list: [
          "Rung thường xuất hiện rõ nhất trong khoảng tốc độ nhất định (VD: 90-110km/h) và giảm khi tăng/giảm tốc.",
          "Nên cân bằng lại lốp mỗi khi thay lốp mới hoặc sau khoảng 10.000km.",
        ],
      },
      {
        heading: "Lốp mòn không đều hoặc biến dạng",
        paragraphs: [
          "Lốp mòn không đều (do áp suất sai, góc đặt bánh xe lệch) hoặc bị phồng rộp một điểm do va chạm ổ gà cũng gây rung ở tốc độ cao, kèm theo tiếng ồn lớn hơn bình thường.",
        ],
      },
      {
        heading: "Góc đặt bánh xe (thước lái) bị lệch",
        paragraphs: [
          "Sau va chạm nhẹ, đi vào ổ gà mạnh hoặc lốp mòn không đều kéo dài, góc đặt bánh xe có thể bị lệch - không chỉ gây rung mà còn khiến xe bị kéo lệch sang một bên khi buông nhẹ tay lái.",
        ],
        list: [
          "Dấu hiệu đi kèm: xe tự lệch sang trái/phải khi thả lỏng vô-lăng trên đường thẳng.",
          "Lốp mòn nhanh và không đều theo thời gian là hậu quả của thước lái sai.",
        ],
      },
      {
        heading: "Khi nào cần kiểm tra ngay",
        list: [
          "Rung tăng dần và ngày càng rõ hơn theo thời gian.",
          "Rung kèm theo tiếng ồn lớn hoặc xe bị lệch lái.",
          "Rung xuất hiện đột ngột sau khi đi qua ổ gà hoặc va chạm.",
        ],
      },
    ],
    callout: {
      title: "Đừng để lâu",
      text: "Rung vô-lăng kéo dài không chỉ gây khó chịu mà còn làm mòn nhanh lốp, bạc đạn bánh xe và các khớp treo. Nên kiểm tra cân bằng lốp và góc đặt bánh xe sớm để tránh hư hỏng lan rộng và tốn kém hơn.",
    },
  },
  {
    slug: "xe-hao-xang-bat-thuong",
    icon: "Fuel",
    tag: "Kiểm tra định kỳ",
    title: "Xe hao xăng bất thường hơn trước",
    excerpt:
      "Có thể do lốp non hơi, lọc gió động cơ bẩn, cảm biến oxy hoạt động sai, hoặc thói quen lái xe thay đổi. So sánh mức tiêu thụ trước/sau để xác định mức độ bất thường thực sự.",
    readTime: "5 phút đọc",
    intro:
      "Cảm giác \"xe dạo này ăn xăng hơn\" khá chủ quan vì mức tiêu thụ còn phụ thuộc điều kiện đường xá, thời tiết và thói quen lái. Trước khi lo lắng, nên xác định mức tăng thực sự rồi mới tìm nguyên nhân kỹ thuật.",
    sections: [
      {
        heading: "Xác định mức hao xăng có thực sự bất thường",
        paragraphs: [
          "So sánh quãng đường đi được trên mỗi lần đổ đầy bình trong 2-3 lần gần nhất, ở điều kiện lái tương tự (cùng cung đường, cùng kiểu lái). Chênh lệch trên 15-20% mới đáng để kiểm tra kỹ thuật.",
        ],
      },
      {
        heading: "Áp suất lốp không đủ",
        paragraphs: [
          "Lốp non hơi làm tăng diện tích tiếp xúc và lực cản lăn, khiến động cơ phải tốn nhiều nhiên liệu hơn để duy trì tốc độ - đây là nguyên nhân đơn giản nhất nhưng hay bị bỏ qua nhất.",
        ],
      },
      {
        heading: "Lọc gió động cơ bị bẩn, tắc nghẽn",
        paragraphs: [
          "Lọc gió bẩn khiến động cơ hút không đủ không khí, hỗn hợp nhiên liệu-không khí không tối ưu, dẫn đến đốt cháy không hiệu quả và hao xăng hơn.",
        ],
        list: [
          "Nên thay lọc gió động cơ mỗi 10.000-15.000km hoặc theo khuyến cáo nhà sản xuất.",
        ],
      },
      {
        heading: "Cảm biến oxy hoặc bugi xuống cấp",
        paragraphs: [
          "Cảm biến oxy hoạt động sai lệch khiến ECU tính toán sai tỷ lệ nhiên liệu-không khí, thường bơm dư nhiên liệu để \"an toàn\" - vừa hao xăng vừa có thể kèm đèn Check Engine sáng.",
        ],
      },
      {
        heading: "Thói quen lái và điều kiện vận hành",
        list: [
          "Đi trong phố đông, dừng-đi liên tục luôn hao xăng hơn đường trường.",
          "Chở nặng, bật điều hoà liên tục, hoặc đi lốp không đúng kích cỡ khuyến nghị cũng làm tăng mức tiêu thụ.",
        ],
      },
    ],
    callout: {
      title: "Nên kiểm tra tổng thể thay vì đoán",
      text: "Nếu đã loại trừ áp suất lốp và thói quen lái mà xe vẫn hao xăng rõ rệt, nên mang xe đến AutoGara để kiểm tra lọc gió, bugi và đọc dữ liệu cảm biến qua máy chẩn đoán - tránh đoán mò và thay nhầm phụ tùng.",
    },
  },
];

export function getTipBySlug(slug) {
  return maintenanceTips.find((t) => t.slug === slug) ?? null;
}
