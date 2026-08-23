import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-8" dir="rtl">
      <article className="max-w-2xl mx-auto space-y-6 pb-16">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Link>

        <header className="space-y-3 border-b border-border pb-4">
          <h1 className="font-display text-2xl sm:text-3xl font-bold gold-text leading-snug">
            מדיניות פרטיות - שולי בן לולו | בית ספר למכירות ו/או עמותת טיפוח עסקים בקהילה
          </h1>
        </header>

        <section className="card-lux p-4 space-y-1 text-sm leading-relaxed">
          <h2 className="font-bold text-base mb-2">פרטי בעל האתר ובעל השליטה במאגר</h2>
          <p>
            דוא&quot;ל:{" "}
            <a className="text-primary underline" href="mailto:sbl.school1@gmail.com">
              sbl.school1@gmail.com
            </a>
          </p>
          <p>טלפון: ‎053-7167675</p>
          <p>
            כתובת URL של האתר:{" "}
            <a className="text-primary underline" href="https://sblschool.co.il" target="_blank" rel="noreferrer">
              https://sblschool.co.il
            </a>{" "}
            |{" "}
            <a className="text-primary underline" href="https://sblliga.com" target="_blank" rel="noreferrer">
              https://sblliga.com
            </a>
          </p>
          <p>מען למכתבים: מצדה 6, קומה 35, בני ברק</p>
        </section>

        <Section title="1. כללי">
          <p>1.1. אנו רואים חשיבות רבה בשמירה על פרטיות המשתמשים באתר, ופועלים בשקיפות ובהתאם להוראות הדין.</p>
          <p>1.2. מטרת מדיניות זו היא להבהיר אילו נתונים נאספים, כיצד נעשה בהם שימוש, ולאילו זכויות אתה זכאי.</p>
          <p>
            1.3. מדיניות פרטיות זו מותאמת להוראות סעיף 11 לחוק הגנת הפרטיות, התשמ&quot;א–1981 (כולל תיקון 13).
          </p>
          <p>1.4. לשון המסמך נכתבה בלשון זכר מטעמי נוחות בלבד, אך מיועדת לכל המשתמשים.</p>
          <p>
            1.5. המשך השימוש באתר מעיד על כך שקראת והסכמת למדיניות זו. אם אינך מעוניין בכך, אנא הימנע משימוש
            באתר.
          </p>
          <p>
            1.6. מסירת פרטים אישיים אינה חובה על פי חוק, אולם ייתכן שבלעדיהם לא נוכל לספק לך שירותים או הרשמה
            מלאה למערכת.
          </p>
        </Section>

        <Section title="2. המידע שאנו אוספים באתר">
          <p>
            2.1. במסגרת השימוש באתר, נאסף מידע שמסרת באופן יזום, לרבות: שם מלא, מספר טלפון, כתובת דואר
            אלקטרוני, תחום עיסוק, פרטי משתמש הנדרשים להפעלת המערכת.
          </p>
          <p>
            2.2. במקרים מסוימים פרטי הלקוחות עשויים לעבור לגורמים חיצוניים לצורך השלמת שירות: חברת משלוחים
            (לצורך אספקה במידה ונדרש), חברת סליקה (לצורך תשלום מאובטח).
          </p>
          <p>
            2.3. בנוסף, ייתכן כי האתר עושה שימוש בכלים אנליטיים (כגון Google Analytics או כלים דומים)
            ובטכנולוגיות מעקב סטנדרטיות (קובצי Cookies או פיקסלים), בין אם הופעלו ישירות ובין אם באמצעות צדדים
            שלישיים.
          </p>
        </Section>

        <Section title="3. איסוף ושמירת המידע">
          <p>
            כל הנתונים שנאספים נשמרים במאגרי מידע של בעל האתר. המידע מאוחסן בשרתי אחסון מאובטחים, אשר יכולים
            להימצא בישראל או בחו&quot;ל. השימוש באתר מהווה הסכמה לשמירת מידע זה.
          </p>
        </Section>

        <Section title="4. מטרות השימוש במידע">
          <p>השימוש בנתונים ייעשה אך ורק בהתאם לדין ולמדיניות זו, ובין היתר לצורך:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>מתן שירותים וגישה למערכת</li>
            <li>יצירת קשר ומתן מענה לפניות</li>
            <li>ניהול חשבונות משתמש ותהליכי הרשמה</li>
            <li>ביצוע עסקאות ותשלומים</li>
            <li>שיפור חוויית המשתמש והתאמת תכנים אישיים</li>
            <li>ניתוח נתוני שימוש באתר לצרכי בקרה ושיפור</li>
            <li>שמירה על אבטחת האתר ומניעת הונאות</li>
            <li>עמידה בהתחייבויות משפטיות או רגולטוריות</li>
          </ul>
        </Section>

        <Section title="5. הבסיס המשפטי לעיבוד המידע">
          <p>עיבוד המידע האישי מבוסס על אחד או יותר מהבסיסים הבאים:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>הסכמתך המפורשת למסירת המידע</li>
            <li>הצורך לספק שירות או לממש התחייבות חוזית</li>
            <li>חובתנו לעמוד בדרישות החוק</li>
            <li>אינטרס לגיטימי של בעל האתר, לרבות אבטחת המערכת ושיפור השירות</li>
          </ul>
        </Section>

        <Section title="6. מסירת מידע לצד שלישי">
          <p>העברת מידע לצדדים שלישיים תתבצע רק במקרים הבאים:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>לחברת סליקה - לצורך תשלומים</li>
            <li>לחברת משלוחים - לצורך אספקה</li>
            <li>לספקי אחסון ותחזוקה טכנית</li>
            <li>לגופים אנליטיים או פלטפורמות פרסום, ככל שייעשה שימוש בקובצי Cookies או בטכנולוגיות מעקב</li>
            <li>אם הדבר נדרש על פי צו שיפוטי או הוראת חוק</li>
            <li>במקרה של מחלוקת משפטית המחייבת גילוי מידע</li>
            <li>במסגרת שינוי מבני בעסק (מיזוג, רכישה, העברת פעילות), בכפוף לשמירה על הוראות מדיניות זו</li>
          </ul>
        </Section>

        <Section title="7. אבטחת מידע">
          <p>
            באתר מיושמים נהלים ואמצעי אבטחה מתקדמים, אך אין ביכולתם להבטיח חסינות מוחלטת מפני חדירה לא מורשית.
            השימוש באתר מהווה הסכמה למגבלות אלו.
          </p>
        </Section>

        <Section title="8. זכויות המשתמש">
          <p>8.1. זכות עיון - אתה רשאי לעיין במידע שנשמר עליך במאגרי המידע.</p>
          <p>
            8.2. זכות תיקון/מחיקה - באפשרותך לפנות ולבקש תיקון או מחיקה של מידע שגוי, חלקי או שאינו דרוש עוד.
          </p>
          <p>8.3. פניות יש להפנות לכתובת הדוא&quot;ל המופיעה בראש מסמך זה.</p>
        </Section>

        <Section title="9. דיווח על פגיעה בפרטיות">
          <p>אם אתה סבור כי פרטיותך נפגעה עקב פעילות האתר, ניתן לפנות אלינו ונשיב בהקדם האפשרי.</p>
        </Section>

        <Section title="10. שינויים במדיניות הפרטיות">
          <p>אנו רשאים לעדכן את מדיניות הפרטיות מעת לעת. שינויים מהותיים יובאו לידיעתך באופן ברור.</p>
        </Section>

        <p className="text-sm text-muted-foreground">מדיניות הפרטיות עודכנה בתאריך: 2026</p>
      </article>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2 text-sm leading-relaxed text-foreground/95">
      <h2 className="font-display text-lg font-bold gold-text">{title}</h2>
      {children}
    </section>
  );
}
