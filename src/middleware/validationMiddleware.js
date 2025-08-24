// Validator functions
const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^(\+98|0)?9\d{9}$/;
  return phoneRegex.test(phoneNumber);
};

const validateNationalCode = (nationalCode) => {
  return /^[0-9]{10}$/.test(nationalCode);
};

const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
  }
  if (!hasUpperCase) {
    return 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد';
  }
  if (!hasLowerCase) {
    return 'رمز عبور باید حداقل یک حرف کوچک داشته باشد';
  }
  if (!hasDigit) {
    return 'رمز عبور باید حداقل یک عدد داشته باشد';
  }
  if (!hasSpecialChar) {
    return 'رمز عبور باید حداقل یک کاراکتر خاص (مانند !@#$%^&*) داشته باشد';
  }
  return null;
};

const validatePostalCode = (postalCode) => {
  return /^[0-9]{10}$/.test(postalCode); 
};

const validateLandline = (landline) => {
  return /^[0-9]{8}$/.test(landline);
};

const validateAreaCode = (areaCode) => {
  return /^[0-9]{3}$/.test(areaCode); 
};

const validateName = (name) => {
  return /^[\u0600-\u06FFa-zA-Z\s]+$/.test(name);
};

const provinceAreaCodeMap = {
  "تهران": ["021"],
  "اصفهان": ["031"],
  "فارس": ["071"],
  "خراسان رضوی": ["051"],
  "آذربایجان شرقی": ["041"],
  "آذربایجان غربی": ["044"],
  "اردبیل": ["045"],
  "البرز": ["026"],
  "ایلام": ["084"],
  "بوشهر": ["077"],
  "چهارمحال و بختیاری": ["038"],
  "خراسان جنوبی": ["056"],
  "خراسان شمالی": ["058"],
  "خوزستان": ["061"],
  "زنجان": ["024"],
  "سمنان": ["023"],
  "سیستان و بلوچستان": ["054"],
  "قزوین": ["028"],
  "قم": ["025"],
  "کردستان": ["087"],
  "کرمان": ["034"],
  "کرمانشاه": ["083"],
  "کهگیلویه و بویراحمد": ["074"],
  "گلستان": ["017"],
  "گیلان": ["013"],
  "لرستان": ["066"],
  "مازندران": ["011"],
  "مرکزی": ["086"],
  "هرمزگان": ["076"],
  "همدان": ["081"],
  "یزد": ["035"],
};

const validateProvinceAreaCode = (province, areaCode) => {
  const validCodes = provinceAreaCodeMap[province];
  return validCodes && validCodes.includes(areaCode);
};

const validateEmail = (email) => {
  return /\S+@\S+\.\S+/.test(email);
};

// Middleware functions
export const profileUpdateValidator = (req, res, next) => {
  const { firstName, lastName, nationalCode, email, mobile, company, landline, fax } = req.body;
  
  if (firstName && !validateName(firstName)) {
    return res.status(400).json({ error: 'نام فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (lastName && !validateName(lastName)) {
    return res.status(400).json({ error: 'نام خانوادگی فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (company && !validateName(company)) {
    return res.status(400).json({ error: 'نام شرکت فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (nationalCode && !validateNationalCode(nationalCode)) {
    return res.status(400).json({ error: 'کد ملی نامعتبر است. باید ۱۰ رقم باشد' });
  }

  if (email && !validateEmail(email)) {
    return res.status(400).json({ error: 'فرمت ایمیل نامعتبر است' });
  }

  if (mobile && !validatePhoneNumber(mobile)) {
    return res.status(400).json({ error: 'فرمت شماره موبایل نامعتبر است' });
  }

  if (landline && !validateLandline(landline)) {
    return res.status(400).json({ error: 'شماره تلفن ثابت باید ۸ رقم باشد' });
  }

  if (fax && !validateLandline(fax)) {
    return res.status(400).json({ error: 'شماره فکس باید ۸ رقم باشد' });
  }

  next();
};

export const passwordChangeValidator = (req, res, next) => {
  const { newPassword } = req.body;
  
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }
  
  next();
};

export const addressValidator = (req, res, next) => {
  const { province, city, postalCode, address, areaCode, landline } = req.body;

  const validProvinces = [
    "تهران", "اصفهان", "فارس", "خراسان رضوی", "آذربایجان شرقی", "آذربایجان غربی",
    "اردبیل", "البرز", "ایلام", "بوشهر", "چهارمحال و بختیاری", "خراسان جنوبی", 
    "خراسان شمالی", "خوزستان", "زنجان", "سمنان", "سیستان و بلوچستان", "قزوین", "قم", 
    "کردستان", "کرمان", "کرمانشاه", "کهگیلویه و بویراحمد", "گلستان", "گیلان", "لرستان", 
    "مازندران", "مرکزی", "هرمزگان", "همدان", "یزد"
  ];

  if (!province || !validProvinces.includes(province)) {
    return res.status(400).json({ error: 'استان نامعتبر است یا وارد نشده' });
  }

  if (!city || city.trim() === '') {
    return res.status(400).json({ error: 'وارد کردن شهر الزامی است' });
  }

  if (!postalCode || !validatePostalCode(postalCode)) {
    return res.status(400).json({ error: 'کد پستی باید ۱۰ رقم باشد' });
  }

  if (!address || address.trim() === '') {
    return res.status(400).json({ error: 'وارد کردن آدرس الزامی است' });
  }

  if (!areaCode || !validateAreaCode(areaCode)) {
    return res.status(400).json({ error: 'کد منطقه باید ۳ رقم باشد' });
  }

  if (!validateProvinceAreaCode(province, areaCode)) {
    return res.status(400).json({ error: 'کد منطقه با استان مطابقت ندارد' });
  }

  if (!landline || !validateLandline(landline)) {
    return res.status(400).json({ error: 'شماره تلفن ثابت باید ۸ رقم باشد' });
  }

  next();
};

export const signupValidator = (req, res, next) => {
  const { email, password, name, lastName, companyName, phoneNumber } = req.body;

  if (!email || !password || !name || !lastName || !phoneNumber) {
    return res.status(400).json({ message: 'فیلدهای ضروری وارد نشده‌اند' });
  }

  if (!validateName(name)) {
    return res.status(400).json({ message: 'نام فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (!validateName(lastName)) {
    return res.status(400).json({ message: 'نام خانوادگی فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (companyName && !validateName(companyName)) {
    return res.status(400).json({ message: 'نام شرکت فقط می‌تواند شامل حروف و فاصله باشد' });
  }

  if (!validatePhoneNumber(phoneNumber)) {
    return res.status(400).json({ message: 'فرمت شماره تلفن نامعتبر است' });
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  next();
};