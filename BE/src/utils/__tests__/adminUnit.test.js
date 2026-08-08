/**
 * Unit tests — logic Admin (validate / SĐT / bỏ dấu / contains search).
 * Chạy: cd BE && npm test
 *
 * Không mở trình duyệt: mỗi case kiểm 1 hàm / 1 quy tắc nhỏ.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeVietnamese,
  bindNormalizedLikeParam,
  phoneDigitsOnly,
  bindPhoneDigitsLikeParam,
  sqlPhoneDigitsExpr,
  sqlPhoneDigitsLike,
  sqlAccentInsensitiveLike,
} = require('../vietnamese');

const {
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly: phoneDigitsForm,
  isValidUsername,
  getUsernameError,
  isValidPersonName,
  getPersonNameError,
  isValidBranchName,
  getBranchNameError,
  isValidPassword,
  parsePositiveInt,
  EMAIL_HINT,
  USERNAME_HINT,
  USERNAME_MIN,
  USERNAME_MAX,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} = require('../fieldValidation');

/** Quy ước tìm Admin: contains + bỏ dấu (giống BE search). */
function accentContains(haystack, needle) {
  return normalizeVietnamese(haystack).includes(normalizeVietnamese(needle));
}

/** Quy ước lọc SĐT Admin: contains trên chữ số (bỏ '-'). */
function phoneContains(stored, query) {
  return phoneDigitsOnly(stored).includes(phoneDigitsOnly(query));
}

/** Format UI SĐT (đồng bộ FE formatPhoneInput) — chỉ để unit test quy ước hiển thị. */
function formatPhoneInput(value) {
  const d = phoneDigitsForm(value);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}

function isPhoneLikeInput(value) {
  const s = String(value || '');
  if (!s.trim()) return false;
  return /^[\d\s\-+.()]+$/.test(s) && /\d/.test(s);
}

// ═══════════════════════════════════════════════════════════
// 1) normalizeVietnamese — bỏ dấu / lower (Admin search tên)
// ═══════════════════════════════════════════════════════════
describe('Admin unit — normalizeVietnamese', () => {
  const cases = [
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['SON', 'son'],
    ['Son', 'son'],
    ['son', 'son'],
    ['Sơn', 'son'],
    ['Sớn', 'son'],
    ['Sởn', 'son'],
    ['Sỡn', 'son'],
    ['Sợn', 'son'],
    ['Nguyễn', 'nguyen'],
    ['Nguyễn Văn A', 'nguyen van a'],
    ['Đặng', 'dang'],
    ['đường', 'duong'],
    ['DƯỠNG', 'duong'],
    ['Hà Nội', 'ha noi'],
    ['Admin1', 'admin1'],
    ['  trim  ', '  trim  '],
    ['Ương', 'uong'],
    ['Ơ', 'o'],
    ['Đ', 'd'],
    ['đ', 'd'],
    ['ế', 'e'],
    ['Ộ', 'o'],
  ];

  for (const [input, expected] of cases) {
    test(`normalize(${JSON.stringify(input)}) => ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeVietnamese(input), expected);
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 2) accentContains — search "son" khớp Sơn/sonn/...
// ═══════════════════════════════════════════════════════════
describe('Admin unit — accentContains (search người dùng)', () => {
  test('son khớp Sơn', () => assert.equal(accentContains('Nguyễn Sơn', 'son'), true));
  test('son khớp Sớn', () => assert.equal(accentContains('Sớn', 'son'), true));
  test('son khớp sonn', () => assert.equal(accentContains('ssonnnn', 'son'), true));
  test('son khớp ssssonn', () => assert.equal(accentContains('ssssonnn', 'son'), true));
  test('son khớp SON', () => assert.equal(accentContains('SONNY', 'son'), true));
  test('admn KHÔNG khớp Admin1', () => assert.equal(accentContains('Admin1', 'admn'), false));
  test('adm khớp Admin1', () => assert.equal(accentContains('Admin1', 'adm'), true));
  test('nguyen khớp Nguyễn', () => assert.equal(accentContains('Nguyễn Văn A', 'nguyen'), true));
  test('van a khớp Nguyễn Văn A', () => assert.equal(accentContains('Nguyễn Văn A', 'van a'), true));
  test('xyz không khớp', () => assert.equal(accentContains('Nguyễn Văn A', 'xyz'), false));
  test('rỗng needle luôn true (includes empty)', () => assert.equal(accentContains('abc', ''), true));
  test('haystack rỗng + needle có chữ = false', () => assert.equal(accentContains('', 'a'), false));
});

// ═══════════════════════════════════════════════════════════
// 3) phone digits + contains (lọc SĐT Admin)
// ═══════════════════════════════════════════════════════════
describe('Admin unit — phoneDigitsOnly / phoneContains', () => {
  test('bỏ dấu gạch', () => assert.equal(phoneDigitsOnly('0123-456-789'), '0123456789'));
  test('bỏ khoảng trắng', () => assert.equal(phoneDigitsOnly('0123 456 789'), '0123456789'));
  test('bỏ dấu chấm', () => assert.equal(phoneDigitsOnly('0123.456.789'), '0123456789'));
  test('bỏ +', () => assert.equal(phoneDigitsOnly('+0123456789'), '0123456789'));
  test('null -> rỗng', () => assert.equal(phoneDigitsOnly(null), ''));
  test('undefined -> rỗng', () => assert.equal(phoneDigitsOnly(undefined), ''));
  test('chỉ chữ -> rỗng', () => assert.equal(phoneDigitsOnly('abc'), ''));
  test('11 số giữ đủ (search không slice)', () => {
    assert.equal(phoneDigitsOnly('01234567890'), '01234567890');
  });
  test('form phoneDigits cắt max 11', () => {
    assert.equal(phoneDigitsForm('012345678901234'), '01234567890');
  });

  test('0123 contains trong 0123456789', () => assert.equal(phoneContains('0123456789', '0123'), true));
  test('0123 contains khi DB có gạch', () => assert.equal(phoneContains('0123-456-789', '0123'), true));
  test('query có gạch vẫn contains', () => assert.equal(phoneContains('0123456789', '0123-456'), true));
  // Lưu ý: 0901234567 CÓ chứa "01234" (vị trí 3–7) — contains chữ số là substring liên tiếp.
  test('0888 KHÔNG khớp 0901234567', () => assert.equal(phoneContains('0901234567', '0888'), false));
  test('0901 khớp 0901-234-567', () => assert.equal(phoneContains('0901-234-567', '0901'), true));
  test('AND giả lập: tên khớp nhưng phone không → loại', () => {
    const nameOk = accentContains('Nguyễn Văn A', 'van');
    const phoneOk = phoneContains('0901234567', '0888');
    assert.equal(nameOk && phoneOk, false);
  });
  test('AND giả lập: tên + phone cùng khớp → giữ', () => {
    const nameOk = accentContains('Admin User', 'admin');
    const phoneOk = phoneContains('0123456789', '0123');
    assert.equal(nameOk && phoneOk, true);
  });
});

// ═══════════════════════════════════════════════════════════
// 4) formatPhoneInput / isPhoneLikeInput (UI Admin)
// ═══════════════════════════════════════════════════════════
describe('Admin unit — formatPhoneInput / isPhoneLikeInput', () => {
  test('4 số không gạch', () => assert.equal(formatPhoneInput('0123'), '0123'));
  test('7 số một gạch', () => assert.equal(formatPhoneInput('0123456'), '0123-456'));
  test('10 số 4-3-3', () => assert.equal(formatPhoneInput('0123456789'), '0123-456-789'));
  test('11 số 4-3-4', () => assert.equal(formatPhoneInput('01234567890'), '0123-456-7890'));
  test('gõ kèm gạch vẫn chuẩn hóa', () => assert.equal(formatPhoneInput('0123-456-789'), '0123-456-789'));
  test('rỗng', () => assert.equal(formatPhoneInput(''), ''));
  test('chữ bị loại', () => assert.equal(formatPhoneInput('01ab23'), '0123'));

  test('0123 là phone-like', () => assert.equal(isPhoneLikeInput('0123'), true));
  test('0123-456 phone-like', () => assert.equal(isPhoneLikeInput('0123-456'), true));
  test('son không phone-like', () => assert.equal(isPhoneLikeInput('son'), false));
  test('admin1 không phone-like', () => assert.equal(isPhoneLikeInput('admin1'), false));
  test('rỗng không phone-like', () => assert.equal(isPhoneLikeInput(''), false));
  test('chỉ --- không phone-like', () => assert.equal(isPhoneLikeInput('---'), false));
  test('+84 912 khoảng trắng phone-like', () => assert.equal(isPhoneLikeInput('+84 912'), true));
});

// ═══════════════════════════════════════════════════════════
// 5) bind params SQL search
// ═══════════════════════════════════════════════════════════
describe('Admin unit — bindNormalizedLikeParam / bindPhoneDigitsLikeParam', () => {
  test('bind tên bỏ dấu thành %son%', () => {
    const p = {};
    bindNormalizedLikeParam(p, 'p1', 'Sơn');
    assert.equal(p.p1, '%son%');
  });
  test('bind Nguyễn Văn A', () => {
    const p = {};
    bindNormalizedLikeParam(p, 'k', 'Nguyễn');
    assert.equal(p.k, '%nguyen%');
  });
  test('bind phone digits %0123%', () => {
    const p = {};
    const key = bindPhoneDigitsLikeParam(p, 'p2', '0123-456');
    assert.equal(key, 'p2');
    assert.equal(p.p2, '%0123456%');
  });
  test('bind phone không số -> null', () => {
    const p = {};
    assert.equal(bindPhoneDigitsLikeParam(p, 'p3', 'abc'), null);
    assert.equal(p.p3, undefined);
  });
  test('sqlPhoneDigitsExpr có REPLACE', () => {
    const expr = sqlPhoneDigitsExpr('u.phone');
    assert.match(expr, /REPLACE/);
    assert.match(expr, /u\.phone/);
  });
  test('sqlPhoneDigitsLike', () => {
    assert.equal(sqlPhoneDigitsLike('ls.phone', 'p1'), `${sqlPhoneDigitsExpr('ls.phone')} LIKE @p1`);
  });
  test('sqlAccentInsensitiveLike có LIKE', () => {
    assert.match(sqlAccentInsensitiveLike('u.user_name', 'p1'), /LIKE @p1/);
  });
});

// ═══════════════════════════════════════════════════════════
// 6) Email
// ═══════════════════════════════════════════════════════════
describe('Admin unit — isValidEmail', () => {
  const valid = [
    'a@gmail.com',
    'user@autogara.vn',
    'sv@fpt.edu.vn',
    'A.B+1@mail.com',
    'x_y@domain.vn',
  ];
  const invalid = [
    null,
    undefined,
    '',
    '   ',
    'a@mail.v',
    'a@example.org',
    'a@b.co',
    'not-an-email',
    '@gmail.com',
    'a@',
    'a@.com',
  ];

  for (const e of valid) {
    test(`email hợp lệ: ${e}`, () => assert.equal(isValidEmail(e), true));
  }
  for (const e of invalid) {
    test(`email không hợp lệ: ${JSON.stringify(e)}`, () => assert.equal(isValidEmail(e), false));
  }
  test('EMAIL_HINT đúng nội dung', () => {
    assert.match(EMAIL_HINT, /\.com/);
    assert.match(EMAIL_HINT, /\.vn/);
  });
});

// ═══════════════════════════════════════════════════════════
// 7) Phone validate (form Admin)
// ═══════════════════════════════════════════════════════════
describe('Admin unit — isValidPhone', () => {
  const valid = [
    '0123456789',
    '01234567890',
    '0123-456-789',
    '0123 456 789',
    '0901234567',
  ];
  const invalid = [
    null,
    undefined,
    '',
    '1234567890', // không bắt đầu bằng 0
    '012345678', // 9 số — thiếu
    'abcdefghij',
    '8123456789',
    '01234567', // quá ngắn
    // lưu ý: '012345678901' (12 số) bị slice(0,11) → vẫn còn 11 số hợp lệ
  ];

  for (const p of valid) {
    test(`phone hợp lệ: ${p}`, () => assert.equal(isValidPhone(p), true));
  }
  for (const p of invalid) {
    test(`phone không hợp lệ: ${JSON.stringify(p)}`, () => assert.equal(isValidPhone(p), false));
  }
});

// ═══════════════════════════════════════════════════════════
// 8) Username
// ═══════════════════════════════════════════════════════════
describe('Admin unit — username', () => {
  test('admin1 hợp lệ', () => assert.equal(isValidUsername('admin1'), true));
  test('ab hợp lệ độ dài? min 3 → false', () => assert.equal(isValidUsername('ab'), false));
  test('abc hợp lệ', () => assert.equal(isValidUsername('abc'), true));
  test('1111111 không hợp lệ (thiếu chữ)', () => assert.equal(isValidUsername('1111111'), false));
  test('user.name_ok hợp lệ', () => assert.equal(isValidUsername('user.name_ok'), true));
  test('user-name hợp lệ', () => assert.equal(isValidUsername('user-name'), true));
  test('null false', () => assert.equal(isValidUsername(null), false));

  test('getUsernameError bắt buộc', () => {
    assert.equal(getUsernameError(''), 'Tên đăng nhập là bắt buộc');
  });
  test('getUsernameError optional trống', () => {
    assert.equal(getUsernameError('', { required: false }), null);
  });
  test('getUsernameError quá ngắn', () => {
    assert.equal(getUsernameError('ab'), `Tên đăng nhập phải từ ${USERNAME_MIN}–${USERNAME_MAX} ký tự`);
  });
  test('getUsernameError quá dài', () => {
    assert.equal(
      getUsernameError('a'.repeat(51)),
      `Tên đăng nhập phải từ ${USERNAME_MIN}–${USERNAME_MAX} ký tự`
    );
  });
  test('getUsernameError ký tự lạ', () => {
    assert.equal(getUsernameError('user!'), 'Tên đăng nhập chỉ gồm chữ, số, ., _, -');
  });
  test('getUsernameError toàn số', () => {
    assert.equal(getUsernameError('12345'), 'Tên đăng nhập phải có ít nhất một chữ cái');
  });
  test('getUsernameError ok', () => {
    assert.equal(getUsernameError('Admin1'), null);
  });
  test('USERNAME_HINT có chữ cái', () => {
    assert.match(USERNAME_HINT, /chữ cái/);
  });
});

// ═══════════════════════════════════════════════════════════
// 9) Person name / Branch name
// ═══════════════════════════════════════════════════════════
describe('Admin unit — person name & branch name', () => {
  test('Nguyễn Văn A hợp lệ', () => assert.equal(isValidPersonName('Nguyễn Văn A'), true));
  test("O'Brien hợp lệ", () => assert.equal(isValidPersonName("O'Brien"), true));
  test('Mary-Jane hợp lệ', () => assert.equal(isValidPersonName('Mary-Jane'), true));
  test('có số không hợp lệ', () => assert.equal(isValidPersonName('User1'), false));
  test('rỗng không hợp lệ', () => assert.equal(isValidPersonName(''), false));
  test('null không hợp lệ', () => assert.equal(isValidPersonName(null), false));

  test('getPersonNameError required', () => {
    assert.equal(getPersonNameError('', { required: true, label: 'Họ' }), 'Họ là bắt buộc');
  });
  test('getPersonNameError optional', () => {
    assert.equal(getPersonNameError('', { required: false }), null);
  });
  test('getPersonNameError quá dài', () => {
    assert.equal(
      getPersonNameError('A'.repeat(NAME_MAX_LENGTH + 1), { required: true, label: 'Tên' }),
      `Tên tối đa ${NAME_MAX_LENGTH} ký tự`
    );
  });
  test('getPersonNameError số', () => {
    assert.match(getPersonNameError('A1', { required: true, label: 'Tên' }), /chữ cái/);
  });
  test('getPersonNameError ok', () => {
    assert.equal(getPersonNameError('Sơn', { required: true }), null);
  });

  test('chi nhánh AutoGara HN ok', () => assert.equal(isValidBranchName('AutoGara Hà Nội'), true));
  test('chi nhánh bắt đầu số fail', () => assert.equal(isValidBranchName('1 Chi nhanh'), false));
  test('chi nhánh rỗng fail', () => assert.equal(isValidBranchName(''), false));
  test('getBranchNameError bắt buộc', () => {
    assert.equal(getBranchNameError(''), 'Tên chi nhánh là bắt buộc');
  });
  test('getBranchNameError bắt đầu số', () => {
    assert.equal(getBranchNameError('9xxx'), 'Tên chi nhánh không được bắt đầu bằng số');
  });
  test('getBranchNameError không chữ', () => {
    assert.equal(getBranchNameError('---'), 'Tên chi nhánh phải có chữ cái');
  });
  test('getBranchNameError quá dài', () => {
    assert.equal(
      getBranchNameError('A'.repeat(NAME_MAX_LENGTH + 1)),
      `Tên chi nhánh tối đa ${NAME_MAX_LENGTH} ký tự`
    );
  });
  test('getBranchNameError ok', () => {
    assert.equal(getBranchNameError('Chi nhánh Cầu Giấy'), null);
  });
});

// ═══════════════════════════════════════════════════════════
// 10) Password + parsePositiveInt
// ═══════════════════════════════════════════════════════════
describe('Admin unit — password & parsePositiveInt', () => {
  test(`password min ${PASSWORD_MIN_LENGTH}`, () => {
    assert.equal(PASSWORD_MIN_LENGTH, 6);
  });
  test('abc123 hợp lệ', () => assert.equal(isValidPassword('abc123'), true));
  test('Abcdef1 hợp lệ', () => assert.equal(isValidPassword('Abcdef1'), true));
  test('abcdef thiếu số', () => assert.equal(isValidPassword('abcdef'), false));
  test('123456 thiếu chữ', () => assert.equal(isValidPassword('123456'), false));
  test('ab12 quá ngắn', () => assert.equal(isValidPassword('ab12'), false));
  test('null false', () => assert.equal(isValidPassword(null), false));
  test('number false', () => assert.equal(isValidPassword(123456), false));
  test('spaces trim vẫn check', () => assert.equal(isValidPassword('  abc123  '), true));

  test('parse 1', () => assert.equal(parsePositiveInt(1), 1));
  test('parse "5"', () => assert.equal(parsePositiveInt('5'), 5));
  test('parse 0 null', () => assert.equal(parsePositiveInt(0), null));
  test('parse -1 null', () => assert.equal(parsePositiveInt(-1), null));
  test('parse 1.5 null', () => assert.equal(parsePositiveInt(1.5), null));
  test('parse abc null', () => assert.equal(parsePositiveInt('abc'), null));
});

// ═══════════════════════════════════════════════════════════
// 11) Bộ case bảng — search Admin (table-driven) để đủ ~150
// ═══════════════════════════════════════════════════════════
describe('Admin unit — bảng search tên (table-driven)', () => {
  const rows = [
    ['son', 'Sơn Nam', true],
    ['son', 'Tran Son', true],
    ['son', 'ssonnnn', true],
    ['son', 'ssssonnn', true],
    ['son', 'Samsung', false],
    ['adm', 'Admin1', true],
    ['admn', 'Admin1', false],
    ['admn', 'Amin Amin', false],
    ['nguyen', 'Nguyễn', true],
    ['duong', 'dưỡng', true],
    ['duong', 'Đường', true],
    ['ha noi', 'Hà Nội', true],
    ['hanoi', 'Hà Nội', false],
    ['a', 'Admin', true],
    ['zzz', 'Admin', false],
    ['VAN', 'nguyễn văn a', true],
    ['van', 'VĂN', true],
    ['', 'anything', true],
    ['x', '', false],
    ['admin', 'superadmin', true],
  ];

  for (const [needle, hay, ok] of rows) {
    test(`accentContains(${JSON.stringify(hay)}, ${JSON.stringify(needle)}) => ${ok}`, () => {
      assert.equal(accentContains(hay, needle), ok);
    });
  }
});

describe('Admin unit — bảng phone contains (table-driven)', () => {
  const rows = [
    ['0123456789', '0123', true],
    ['0123-456-789', '456', true],
    ['0123-456-789', '0123456789', true],
    ['0901234567', '0888', false],
    ['0901-234-567', '0901234567', true],
    ['0901-234-567', '234', true],
    ['', '0', false],
    ['0123456789', '', true],
    ['02833332222', '028', true],
    ['028-3333-2222', '33332222', true],
    ['01234567890', '7890', true],
    ['abc', '1', false],
    ['0123', '01234', false],
    ['+84123456789', '123456789', true],
    ['0123 456 789', '345', true],
  ];

  for (const [stored, query, ok] of rows) {
    test(`phoneContains(${JSON.stringify(stored)}, ${JSON.stringify(query)}) => ${ok}`, () => {
      assert.equal(phoneContains(stored, query), ok);
    });
  }
});

describe('Admin unit — bảng formatPhoneInput (table-driven)', () => {
  const rows = [
    ['0', '0'],
    ['09', '09'],
    ['0912', '0912'],
    ['09123', '0912-3'],
    ['0912345', '0912-345'],
    ['09123456', '0912-345-6'],
    ['0912345678', '0912-345-678'],
    ['09123456789', '0912-345-6789'],
    ['0912-345-678', '0912-345-678'],
    ['(0912)345678', '0912-345-678'],
  ];

  for (const [raw, formatted] of rows) {
    test(`format(${raw}) => ${formatted}`, () => {
      assert.equal(formatPhoneInput(raw), formatted);
    });
  }
});
