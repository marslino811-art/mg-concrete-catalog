تحديث كتالوج MG Concrete

الملفات:
1) app.js
2) style.css
3) export_catalog.py

طريقة التركيب:
- افتح فولدر الكتالوج:
  C:\Users\MARSLINO\Desktop\mg_catalog_web
- خذ نسخة احتياطية من الملفات القديمة.
- استبدل الملفات الثلاثة الجديدة بنفس الأسماء.
- شغل:
  python export_catalog.py
- افتح index.html واضغط Ctrl + F5.

ما الجديد؟
1) الصور بقت أصغر ومش مقصوصة:
   الكارت بيعرض الصورة كاملة باستخدام object-fit: contain.

2) دعم أكثر من صورة للمنتج:
   ملف products.json أصبح يدعم:
   "image": "images/product_1_1.jpg",
   "images": [
     "images/product_1_1.jpg",
     "images/product_1_2.jpg",
     "images/product_1_3.jpg"
   ]

3) إضافة صور زيادة من غير تعديل البرنامج:
   export_catalog.py يعمل فولدر اسمه:
   extra_images

   لو كود المنتج 3، اعمل فولدر:
   extra_images\3

   وحط جواه الصور:
   1.jpg
   2.jpg
   3.jpg

   ثم شغل:
   python export_catalog.py

   بعدها الكتالوج يعرض أسهم وصور مصغرة للتبديل بين الصور.

مثال:
extra_images\3\1.jpg
extra_images\3\2.jpg
extra_images\3\3.jpg

ملاحظة:
الصورة الأساسية لسه بتطلع من البرنامج، والصور الإضافية بتتحط في extra_images حسب كود المنتج.
