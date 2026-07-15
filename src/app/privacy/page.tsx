import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — منصة همّة التعليمية",
  description: "سياسة الخصوصية لمنصة همّة التعليمية — كيف نحمي بياناتك الشخصية.",
};

export default function PrivacyPage() {
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
          <h1 className="font-display text-3xl font-bold mb-2">سياسة الخصوصية</h1>
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
              تلتزم منصة همّة التعليمية (&quot;المنصة&quot;، &quot;نحن&quot;، &quot;لنا&quot;) 
              بحماية خصوصيتك. تصف سياسة الخصوصية هذه كيفية جمع واستخدام وحماية 
              معلوماتك الشخصية عند استخدامك للمنصة.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              باستخدامك للمنصة، فإنك توافق على ممارسات جمع البيانات الموضحة في 
              هذه السياسة.
            </p>
          </section>

          {/* 2 - What we collect */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٢. المعلومات التي نجمعها</h2>

            <h3 className="text-lg font-medium mt-4 mb-1">المعلومات التي تقدّمها لنا:</h3>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong>معلومات الحساب:</strong> الاسم والبريد الإلكتروني والصورة 
                الرمزية — يتم الحصول عليها من حساب Google الخاص بك عند تسجيل الدخول 
                عبر OAuth.
              </li>
              <li>
                <strong>بيانات التقدّم الدراسي:</strong> إجاباتك على الأسئلة، نتائج 
                الاختبارات، وقت المذاكرة، البطاقات التي راجعتها، الأخطاء التي 
                ارتكبتها، ونقاط الخبرة والمستويات.
              </li>
              <li>
                <strong>الأهداف والتحديات:</strong> أهداف التعلّم اليومية، المشاركة 
                في التحديات الأسبوعية، والإنجازات.
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-1">المعلومات التي نجمعها تلقائيًا:</h3>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong>بيانات الاستخدام:</strong> الصفحات التي تزورها، الميزات التي 
                تستخدمها، الوقت الذي تقضيه على المنصة.
              </li>
              <li>
                <strong>البيانات التقنية:</strong> نوع المتصفح، نظام التشغيل، عنوان 
                IP التقريبي، نوع الجهاز.
              </li>
              <li>
                <strong>بيانات الأداء:</strong> أخطاء التطبيق وبيانات الأداء (عبر 
                Sentry) لتحسين استقرار المنصة.
              </li>
            </ul>
          </section>

          {/* 3 - How we use */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٣. كيف نستخدم معلوماتك</h2>
            <p className="text-muted-foreground leading-relaxed">نستخدم معلوماتك للأغراض التالية:</p>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground mt-2">
              <li>تقديم خدمات المنصة وتحسينها (المذاكرة، الاختبارات، المراجعة الذكية).</li>
              <li>تخصيص تجربتك التعليمية بناءً على أدائك (الخطة الذكية، اقتراحات الدراسة).</li>
              <li>إرسال إشعارات تذكيرية للمذاكرة (إذا فعّلت الإشعارات).</li>
              <li>تحليل الاتجاهات العامة لتحسين جودة المحتوى التعليمي.</li>
              <li>تشخيص وإصلاح الأخطاء التقنية.</li>
              <li>الامتثال للالتزامات القانونية.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٤. تخزين البيانات وأمانها</h2>
            <p className="text-muted-foreground leading-relaxed">
              تُخزَّن بياناتك على قواعد بيانات <strong>Neon</strong> (PostgreSQL) في 
              السحابة، مع تشفير أثناء النقل (SSL/TLS) والتخزين. نحن نتخذ إجراءات 
              أمنية معقولة لحماية بياناتك، ولكن لا يمكن ضمان الأمان المطلق لأي نظام 
              متصل بالإنترنت.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              تُحتفظ ببيانات حسابك طالما أن حسابك نشط. إذا حذفت حسابك، سنقوم بحذف 
              بياناتك الشخصية خلال ٣٠ يومًا، باستثناء البيانات المجمّعة وغير 
              المحددة الهوية التي قد نحتفظ بها لأغراض تحليلية.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٥. مشاركة البيانات مع أطراف ثالثة</h2>
            <p className="text-muted-foreground leading-relaxed">
              نحن لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك بياناتك مع:
            </p>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground mt-2">
              <li>
                <strong>Google:</strong> للمصادقة عبر OAuth — نشارك فقط معرف 
                المستخدم اللازم للتحقق من الهوية.
              </li>
              <li>
                <strong>Neon:</strong> كمزود لاستضافة قاعدة البيانات.
              </li>
              <li>
                <strong>Sentry:</strong> لتتبّع الأخطاء وتحسين أداء المنصة — لا يتم 
                مشاركة بيانات شخصية محددة.
              </li>
              <li>
                <strong>Google Gemini API:</strong> لتحليل الأداء وتوليد التوصيات 
                التعليمية — تُرسل بيانات الأسئلة بدون معلومات تعريف شخصية.
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٦. ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-muted-foreground leading-relaxed">
              نستخدم ملفات تعريف الارتباط الضرورية لتشغيل المنصة، بما في ذلك:
            </p>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground mt-2">
              <li>حفظ حالة تسجيل الدخول (جلسة NextAuth).</li>
              <li>تخزين تفضيلات السمة (الوضع الفاتح/الداكن).</li>
              <li>حفظ حالة الجولة التعريفية (عدم إظهارها مرة أخرى).</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              لا نستخدم ملفات تعريف الارتباط للتتبّع الإعلاني أو التسويقي.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٧. حقوقك</h2>
            <p className="text-muted-foreground leading-relaxed">
              لديك الحقوق التالية بخصوص بياناتك الشخصية:
            </p>
            <ul className="list-disc pr-5 space-y-1.5 text-muted-foreground mt-2">
              <li><strong>حق الوصول:</strong> يمكنك طلب نسخة من بياناتك الشخصية.</li>
              <li><strong>حق التصحيح:</strong> يمكنك تعديل بياناتك من خلال حسابك.</li>
              <li><strong>حق الحذف:</strong> يمكنك طلب حذف حسابك وبياناتك.</li>
              <li><strong>حق تقييد المعالجة:</strong> يمكنك طلب الحد من معالجة بياناتك.</li>
              <li><strong>حق نقل البيانات:</strong> يمكنك طلب نقل بياناتك بصيغة منظمة.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              لممارسة أي من هذه الحقوق، يُرجى التواصل معنا عبر البريد الإلكتروني أدناه.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٨. خصوصية الأطفال</h2>
            <p className="text-muted-foreground leading-relaxed">
              المنصة مُصمّمة للطلاب الذين تبلغ أعمارهم ١٣ عامًا أو أكثر. نحن لا 
              نجمع عن قصد معلومات شخصية من الأطفال دون ١٣ عامًا. إذا علمنا أننا 
              جمعنا بيانات من طفل دون ١٣ عامًا، سنقوم بحذف هذه البيانات فورًا.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">٩. التعديلات على سياسة الخصوصية</h2>
            <p className="text-muted-foreground leading-relaxed">
              قد نقوم بتحديث هذه السياسة من وقت لآخر. سنقوم بإشعارك بأي تغييرات 
              جوهرية عبر البريد الإلكتروني أو من خلال إشعار على المنصة. يُرجى مراجعة 
              هذه الصفحة بشكل دوري للاطّلاع على أحدث المعلومات.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-2">١٠. اتصل بنا</h2>
            <p className="text-muted-foreground leading-relaxed">
              إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية هذه أو ممارسات 
              الخصوصية لدينا، يُرجى التواصل معنا:
            </p>
            <div className="mt-3 space-y-1 text-muted-foreground">
              <p>
                البريد الإلكتروني:{" "}
                <a
                  href="mailto:support@hema-lms.com"
                  className="text-primary hover:underline"
                >
                  support@hema-lms.com
                </a>
              </p>
              <p>
                المطوّر:{" "}
                <a
                  href="https://portfolio-yousef-hanafy.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  يوسف حنفي
                </a>
              </p>
            </div>
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
