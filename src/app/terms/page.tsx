import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "شروط الاستخدام — منصة همّة التعليمية",
  description: "شروط استخدام منصة همّة التعليمية للتحضير لاختبار القدرات اللفظية.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى التطبيق</span>
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold mb-2">شروط الاستخدام</h1>
          <p className="text-sm text-muted-foreground">
            آخر تحديث: ١٥ يوليو ٢٠٢٦
          </p>
        </div>

        {/* Content */}
        <div className="max-w-none space-y-8">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">١. مقدمة</h2>
            <p className="text-muted-foreground leading-relaxed">
              مرحبًا بك في منصة همّة التعليمية (&quot;المنصة&quot;، &quot;نحن&quot;، &quot;لنا&quot;). 
              باستخدامك للمنصة، فإنك توافق على هذه الشروط (&quot;شروط الاستخدام&quot;). 
              إذا كنت لا توافق على أي جزء من هذه الشروط، فيُرجى عدم استخدام المنصة.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              المنصة مملوكة ومُدارة من قبل <strong>يوسف حنفي</strong>، ومُصمّمة 
              لمساعدة الطلاب على التحضير لاختبار القدرات اللفظية من خلال أدوات 
              المذاكرة والاختبارات والمراجعة الذكية.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٢. الحسابات والتسجيل</h2>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground">
              <li>يجب عليك إنشاء حساب باستخدام حساب Google الخاص بك للوصول إلى المنصة.</li>
              <li>أنت وحدك المسؤول عن الحفاظ على سرية حسابك.</li>
              <li>يجب أن تكون عمرك ١٣ عامًا على الأقل لاستخدام المنصة. إذا كان عمرك أقل من ١٨ عامًا، فيجب أن يكون لديك موافقة ولي الأمر.</li>
              <li>نحتفظ بالحق في تعليق أو إنهاء أي حساب ينتهك هذه الشروط.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٣. استخدام المنصة</h2>
            <p className="text-muted-foreground leading-relaxed">
              أنت توافق على استخدام المنصة للأغراض التعليمية فقط. يُمنع منعًا باتًا:
            </p>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground mt-2">
              <li>نسخ أو إعادة توزيع المحتوى التعليمي دون إذن خطي.</li>
              <li>محاولة اختراق أمان المنصة أو الوصول إلى بيانات مستخدمين آخرين.</li>
              <li>استخدام المنصة لأي غرض غير قانوني.</li>
              <li>نشر أو مشاركة محتوى مسيء أو غير لائق.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٤. المحتوى التعليمي</h2>
            <p className="text-muted-foreground leading-relaxed">
              جميع الأسئلة، الشروحات، والمواد التعليمية المتاحة على المنصة هي ملكية 
              فكرية للمنصة أو لمُرَخّصيها. يُمنع إعادة نشر أو بيع المحتوى التعليمي 
              دون موافقة خطية صريحة.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              بينما نبذل قصارى جهدنا لضمان دقة المحتوى، فإننا لا نضمن أن تكون 
              جميع المواد خالية من الأخطاء أو مناسبة لجميع المستخدمين.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٥. البيانات والخصوصية</h2>
            <p className="text-muted-foreground leading-relaxed">
              جمع واستخدام بياناتك الشخصية يخضع لـ 
              <Link href="/privacy" className="text-primary hover:underline mx-1">
                سياسة الخصوصية
              </Link>
              الخاصة بنا. باستخدامك للمنصة، فإنك توافق على جمع واستخدام بياناتك وفقًا 
              لسياسة الخصوصية.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٦. إخلاء المسؤولية</h2>
            <p className="text-muted-foreground leading-relaxed">
              تُقدَّم المنصة &quot;كما هي&quot; دون أي ضمانات، صريحة أو ضمنية. 
              نحن لا نضمن أن المنصة ستكون خالية من الأخطاء أو متاحة بشكل متواصل. 
              المنصة وأدواتها التعليمية هي أدوات مساعدة للتحضير للاختبارات، ولا نضمن 
              تحقيق أي نتائج محددة في الاختبارات الفعلية.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٧. الحدود القصوى للمسؤولية</h2>
            <p className="text-muted-foreground leading-relaxed">
              في أي حال من الأحوال، لن تكون المنصة أو القائمون عليها مسؤولين عن أي 
              أضرار غير مباشرة أو تبعية ناتجة عن استخدام أو عدم القدرة على استخدام 
              المنصة، حتى إذا تم إبلاغنا بإمكانية حدوث مثل هذه الأضرار.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٨. إنهاء الخدمة</h2>
            <p className="text-muted-foreground leading-relaxed">
              نحتفظ بالحق في تعليق أو إنهاء وصولك إلى المنصة في أي وقت، بدون إشعار 
              مسبق، إذا اعتقدنا أنك انتهكت هذه الشروط. يمكنك أيضًا حذف حسابك في أي 
              وقت من خلال صفحة الإعدادات.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٩. التعديلات على الشروط</h2>
            <p className="text-muted-foreground leading-relaxed">
              قد نقوم بتحديث هذه الشروط من وقت لآخر. سنقوم بإشعارك بأي تغييرات جوهرية 
              عبر البريد الإلكتروني أو من خلال إشعار على المنصة. استمرارك في استخدام 
              المنصة بعد التحديث يعني موافقتك على الشروط المعدّلة.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">١٠. القانون الواجب التطبيق</h2>
            <p className="text-muted-foreground leading-relaxed">
              تخضع هذه الشروط وتُفسَّر وفقًا لقوانين المملكة العربية السعودية. 
              أي نزاعات تنشأ عن هذه الشروط ستُحل في المحاكم السعودية المختصة.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">١١. اتصل بنا</h2>
            <p className="text-muted-foreground leading-relaxed">
              إذا كان لديك أي أسئلة حول هذه الشروط، يُرجى التواصل معنا عبر:
            </p>
            <p className="text-muted-foreground mt-1">
              البريد الإلكتروني:{" "}
              <a
                href="mailto:support@hema-lms.com"
                className="text-primary hover:underline"
              >
                support@hema-lms.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} منصة همّة التعليمية. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </div>
  );
}
