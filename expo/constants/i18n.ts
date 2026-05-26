import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "ar";

const STORAGE_KEY = "@sawa.lang";

/**
 * Arabic-keyed translation map. Lookup returns the English string when language is "en",
 * otherwise returns the Arabic key unchanged.
 */
const EN: Record<string, string> = {
  // Brand & generic
  "سوا": "Sawa",
  "Sawa v1.0 · صنع بـ ❤️ بلبنان": "Sawa v1.0 · Made with ❤️ in Lebanon",

  // Welcome / phone / otp
  "عيش اللحظة مع أصحابك": "Live the moment with your friends",
  "ابدأ برقم هاتفك": "Start with your phone number",
  "بالتسجيل أنت موافق على شروط الاستخدام": "By signing up you agree to the Terms of Use",
  "ادخل كضيف": "Continue as guest",
  "رقم هاتفك": "Your phone number",
  "شو رقمك؟": "What's your number?",
  "رح نبعتلك رمز تحقق": "We'll send you a verification code",
  "إرسال الرمز": "Send code",
  "ما رح نبعتلك أي شي تاني": "We won't send you anything else",
  "رجوع": "Back",
  "تحقق من رقمك": "Verify your number",
  "أدخل الرمز": "Enter the code",
  "ما وصلك الرمز؟": "Didn't get the code?",
  "أعد الإرسال": "Resend",
  "تحقق": "Verify",
  "بعتنالك رمز على": "We sent a code to",
  "إعادة الإرسال بعد": "Resend in",
  "وضع تجريبي · رمزك": "Demo mode · your code",
  "اضغط للتعبئة": "Tap to autofill",
  "اضغط لتعبئة الرمز التجريبي": "Tap to autofill the demo code",

  // Profile setup
  "عرّف عن نفسك": "Tell us about you",
  "بدنا نعرف مين أنت": "We want to know who you are",
  "اختر صورتك": "Pick a photo",
  "اسمك": "Your name",
  "مثلاً: رالف": "e.g. Ralph",
  "هيا نبدأ 🎉": "Let's go 🎉",
  "هيا نبدأ": "Let's go",

  // Home tabs / filters
  "يلا 🎯": "Plans 🎯",
  "لحظات ✨": "Moments ✨",
  "الكل": "All",
  "أصحابي": "Friends",
  "قريب مني": "Near me",
  "عامل البلان": "Plan host",
  "انضم": "Join",

  // Plan card titles
  "عالبحر اليوم ☀️": "Beach today ☀️",
  "عشاء بمار مخايل 🌙": "Dinner at Mar Mikhael 🌙",
  "ماتش فوتبول بالشب": "Football with the guys",
  "قهوة الصبح بالحمرا": "Morning coffee in Hamra",

  // Locations
  "رملة البيضا": "Ramlet El Bayda",
  "رملة البيضا · بيروت": "Ramlet El Bayda · Beirut",
  "ملعب الجامعة": "University field",
  "Em Sherif Café": "Em Sherif Café",
  "Em Sherif Café · مار مخايل": "Em Sherif Café · Mar Mikhael",
  "Cafe Younes": "Cafe Younes",
  "جونيه": "Jounieh",
  "مار مخايل": "Mar Mikhael",
  "الحدت": "Hadath",
  "الحمرا": "Hamra",
  "بدارو": "Badaro",
  "فقرا": "Faqra",
  "بيت الدين": "Beit El Dine",

  // Times
  "٤:٣٠ م": "4:30 PM",
  "٩:٠٠ م": "9:00 PM",
  "٧:٠٠ م": "7:00 PM",
  "١٠:٣٠ ص": "10:30 AM",
  "اليوم": "Today",
  "اليوم · ٤:٣٠ م": "Today · 4:30 PM",
  "اليوم · ٩:٠٠ م": "Today · 9:00 PM",

  // Spots / counts
  "٦ من ١٠": "6 of 10",
  "٤ من ٨": "4 of 8",
  "٨ من ١٢": "8 of 12",
  "٣ من ٦": "3 of 6",
  "٦ من ١٠ أشخاص": "6 of 10 people",
  "٤ من ٨ أشخاص": "4 of 8 people",

  // Ago / joined
  "منذ ١٢ دقيقة": "12 min ago",
  "منذ ٤٥ دقيقة": "45 min ago",
  "منذ ساعة": "1 hour ago",
  "منذ ساعتين": "2 hours ago",
  "عمل البلان · منذ ٢ ساعة": "Hosted · 2h ago",
  "عملت البلان · منذ ٣ ساعات": "Hosted · 3h ago",
  "انضم منذ ساعة": "Joined 1h ago",
  "انضم منذ ساعتين": "Joined 2h ago",
  "انضمت منذ ساعة": "Joined 1h ago",
  "انضمت منذ ٤٥ دقيقة": "Joined 45min ago",
  "انضمت منذ ٣٠ دقيقة": "Joined 30min ago",
  "انضم منذ ٢٠ دقيقة": "Joined 20min ago",
  "انضم منذ ١٢ دقيقة": "Joined 12min ago",
  "انضم منذ ٤٥ دقيقة": "Joined 45min ago",

  // Names (people)
  "رالف": "Ralph",
  "رالف خوري": "Ralph Khoury",
  "كريم": "Karim",
  "ليا": "Lia",
  "نور": "Nour",
  "مازن": "Mazen",
  "جاد": "Jad",
  "سارة": "Sara",
  "زياد": "Ziad",
  "ليلى حداد": "Layla Haddad",
  "كريم نصار": "Karim Nassar",
  "زياد أبي خليل": "Ziad Abi Khalil",
  "ميرا شلهوب": "Mira Chalhoub",
  "أحمد قاسم": "Ahmad Kassem",
  "سارة منصور": "Sara Mansour",
  "خليل عقل": "Khalil Akl",
  "نور الدين": "Noureddine",
  "أحمد": "Ahmad",
  "خليل": "Khalil",

  // Moments
  "🏖️ عالبحر مع الشباب": "🏖️ Beach with the boys",
  "🍽️ عشاء مار مخايل": "🍽️ Dinner Mar Mikhael",
  "⚽ ماتش الجامعة": "⚽ University match",
  "☕ قهوة الصبح": "☕ Morning coffee",
  "🎉 سهرة عيد ميلاد ليا": "🎉 Lia's birthday party",
  "🌄 طلعة فقرا": "🌄 Faqra hike",
  "🎶 حفلة بيت الدين": "🎶 Beiteddine concert",
  "٦ أشخاص": "6 people",
  "٤ أشخاص": "4 people",
  "٨ أشخاص": "8 people",
  "٣ أشخاص": "3 people",
  "٧ أشخاص": "7 people",
  "٥ أشخاص": "5 people",
  "١٠ أشخاص": "10 people",
  "١٢ شخص": "12 people",
  "أمس": "Yesterday",
  "الجمعة": "Friday",
  "الخميس": "Thursday",
  "الاثنين": "Monday",
  "الأحد الماضي": "Last Sunday",
  "السبت": "Saturday",
  "الأسبوع الماضي": "Last week",
  "الأحدث": "Latest",
  "ما في لحظات بعد": "No moments yet",
  "عمل أول plan وعيش اللحظة": "Make your first plan and live it",
  "عمل plan هلق": "Make a plan now",

  // Create plan
  "بلان جديد": "New plan",
  "نشر": "Post",
  "إغلاق": "Close",
  "شو رح تعملوا؟": "What are you doing?",
  "أكل": "Food",
  "رياضة": "Sport",
  "سهرة": "Night out",
  "بحر": "Beach",
  "مناسبة": "Event",
  "تاني": "Other",
  "عنوان البلان": "Plan title",
  "وين؟": "Where?",
  "أضف موقع": "Add a location",
  "الوقت": "Time",
  "التاريخ": "Date",
  "أكتر عدد": "Max people",
  "أشخاص": "people",
  "مين يقدر يشوف؟": "Who can see this?",
  "عام": "Public",
  "أصحاب فقط": "Friends only",

  // Plan detail
  "مباشر": "Live",
  "PlanReal رح يصير بوقت عشوائي": "PlanReal will trigger at a random time",
  "كونوا جاهزين 👀": "Be ready 👀",
  "مين جاي؟": "Who's coming?",
  "المنظم": "Host",
  "انضم للبلان": "Join the plan",
  "اترك البلان": "Leave the plan",

  // Camera
  "صوّر اللحظة": "Capture the moment",
  "من": "of",
  "صوّروا": "captured",
  "عم ننتظر الباقين...": "Waiting for the others...",
  "تم التصوير ✓": "Captured ✓",
  "السماح بالكاميرا": "Allow camera",
  "كل الشباب صوّروا 🎉": "Everyone captured 🎉",

  // Mosaic
  "لحظتكم": "Your moment",
  "📍 جونيه": "📍 Jounieh",
  "سوا ◈": "Sawa ◈",
  "شارك على Instagram": "Share to Instagram",
  "احفظ الصورة": "Save image",
  "هاللحظة رح تفضل معك للأبد ✨": "This moment is yours forever ✨",
  "تم": "Done",

  // Me / profile
  "أنا": "Me",
  "بلان": "Plans",
  "لحظة": "Moments",
  "صاحب": "Friends",
  "ذكرياتك": "Your memories",
  "عالبحر مع الشباب 🏖️": "Beach with the boys 🏖️",
  "ماتش الأحد ⚽": "Sunday match ⚽",
  "سهرة عند رالف 🛋️": "Night at Ralph's 🛋️",
  "قهوة الصبح ☕": "Morning coffee ☕",
  "🏖️ بحر": "🏖️ Beach",
  "🍽️ أكل": "🍽️ Food",
  "⚽ رياضة": "⚽ Sport",
  "🛋️ سهرة": "🛋️ Night out",
  "☕ قهوة": "☕ Coffee",
  "١٥ يوليو ٢٠٢٥": "Jul 15, 2025",
  "٢ يوليو ٢٠٢٥": "Jul 2, 2025",
  "٢٣ يونيو ٢٠٢٥": "Jun 23, 2025",
  "١٤ يونيو ٢٠٢٥": "Jun 14, 2025",
  "١ يونيو ٢٠٢٥": "Jun 1, 2025",
  "٢٣": "23",
  "١٨": "18",
  "٤٧": "47",

  // Settings
  "الإعدادات": "Settings",
  "تعديل": "Edit",
  "الحساب": "Account",
  "الدعم": "Support",
  "تعديل الملف الشخصي": "Edit profile",
  "الإشعارات": "Notifications",
  "خصوصية التايم لاين": "Timeline privacy",
  "مساعدة": "Help",
  "قيّم التطبيق": "Rate the app",
  "شارك Sawa": "Share Sawa",
  "تسجيل الخروج": "Sign out",
  "حذف الحساب": "Delete account",
  "اللغة": "Language",
  "العربية": "Arabic",
  "English": "English",

  // Friends
  "أصحابك": "Your friends",
  "دور على أصحابك": "Search your friends",
  "من جهات اتصالك": "From your contacts",
  "على Sawa": "on Sawa",
  "إضافة": "Add",
  "تمّت ✓": "Added ✓",
  "شوف الكل": "See all",
  "٥ بلانات سوا ✨": "5 plans together ✨",
  "١٢ بلان سوا ✨": "12 plans together ✨",
  "٨ بلانات سوا ✨": "8 plans together ✨",
  "٣ بلانات سوا ✨": "3 plans together ✨",
  "ما في أصحاب بعد": "No friends yet",
  "دعوا أصحابك على Sawa": "Invite your friends to Sawa",
  "دعوة أصحاب": "Invite friends",
  "امسح الكود": "Scan the code",

  // Phone screen — returning user flow
  "أهلاً وسهلاً! 👋": "Welcome back! 👋",
  "رح نبعتلك رمز لتدخل على حسابك": "We'll send you a code to log in",
  "رقم جديد — رح نسجّلك على Sawa ✨": "New number — we'll create your account ✨",
  "أرسل رمز الدخول": "Send login code",

  // Friends screen
  "دور على اسم صاحبك": "Search by name",
  "طلبات صداقة": "Friend requests",
  "بدو يكون صاحبك": "Wants to be your friend",
  "بانتظار": "Pending",
  "قبول": "Accept",
  "رفض": "Decline",
  "بانتظار الرد": "Waiting for reply",
  "نتائج البحث": "Search results",
  "ما لقينا حدا بهالاسم": "Nobody found with that name",
  "طلبات مرسلة": "Sent requests",
  "صاحبك على Sawa": "Your friend on Sawa",
  "دور باسم صاحبك فوق أو ابعتلو دعوة": "Search above or send an invite",
  "انضم لـ Sawa وعيش اللحظة مع أصحابك — https://sawa.app": "Join Sawa and live the moment with your friends — https://sawa.app",
  "سجّل الدخول لتضيف أصحاب حقيقيين": "Sign in to add real friends",
  "تسجيل الدخول": "Sign in",
  "صاحبك": "Friend",
  "بدون اسم": "No name",

  // Me screen
  "بلان": "Plans",
  "لحظة": "Moments",
  "صاحب": "Friends",
  "ذكرياتك": "Your memories",
  "ما في ذكريات بعد": "No memories yet",
  "عمل بلان وصور لحظاتك": "Make a plan and capture your moments",
  "أنا": "Me",

  // Home screen
  "عامل البلان": "Plan host",
  "Plan host": "Plan host",
  "صاحب البلان": "Plan host",
  "عملت البلان": "Hosted",
  "شخص": "person",
  "أشخاص": "people",


  // Home bottom nav
  "الرئيسية": "Home",
  "اكتشف": "Discover",
};

const STRINGS = { en: EN } as const;

export const [LangProvider, useLang] = createContextHook(() => {
  const [lang, setLangState] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (cancelled) return;
        if (v === "ar" || v === "en") setLangState(v);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((cur) => {
      const next: Lang = cur === "en" ? "ar" : "en";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (lang === "ar") return key;
      const table = STRINGS.en;
      return table[key] ?? key;
    },
    [lang]
  );

  return useMemo(
    () => ({ lang, setLang, toggleLang, t, hydrated, isRTL: lang === "ar" }),
    [lang, setLang, toggleLang, t, hydrated]
  );
});

/** Convenience hook returning just the `t` function. */
export function useT(): (key: string) => string {
  const { t } = useLang();
  return t;
}
