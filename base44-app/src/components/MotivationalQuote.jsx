import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const QUOTES = [
  "העסק שרוצים נבנה מהפעולות שעושים היום.",
  "אין קסם — יש התמדה וביצוע יומיומי.",
  "מי שממתין למוטיבציה, מפסיד למי שפשוט עושה.",
  "השטח לא מחכה לאף אחד. גם לא לך.",
  "כל משימה קטנה היא אבן בבניין של העסק שלך.",
  "אלופים לא מתנצלים על שאפתנות.",
  "העסק שלך לא חייב לך הצלחה. אתה חייב לו עבודה.",
  "התירוצים לא משלמים חשבונות.",
  "אף אחד לא יבנה את העסק שלך במקומך.",
  "מי שמחכה להזדמנות, מפספס את זו שכבר מולו.",
  "ההבדל בין חלום לעסק הוא ביצוע.",
  "אם לא תנהל את היום שלך, היום ינהל אותך.",
  "המשימות הקשות הן אלה שמייצרות את הפריצות הגדולות.",
  "כל דחייה היום היא עיכוב של ההצלחה מחר.",
  "העקביות מנצחת כישרון שלא עובד.",
  "השאלה היא לא אם תצליח. השאלה היא אם תתמיד מספיק.",
];

const ROTATE_MS = 3600000;

export default function MotivationalQuote() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5 }}
          className="text-sm text-center font-medium text-muted-foreground leading-snug"
        >
          {QUOTES[index]}
        </motion.p>
      </AnimatePresence>
      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
    </div>
  );
}