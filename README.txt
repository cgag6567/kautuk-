लाइव क्विज़ (Kahoot जैसा) — Netlify पर चलाने के निर्देश
=========================================================
तरीका A (GitHub से, सबसे भरोसेमंद)
 1. इस फोल्डर को एक नए GitHub रिपॉजिटरी में डालें (node_modules छोड़ दें; .gitignore में है)।
 2. Netlify > Add new site > Import from Git > वही रिपॉजिटरी चुनें। Build command खाली, Publish directory: public
    (netlify.toml में यह पहले से लिखा है)।
 3. Site configuration > Change site name से नाम रखें, जैसे aapkaquiz → aapkaquiz.netlify.app

तरीका B (CLI से)
 1. npm install
 2. npx netlify-cli deploy --prod     (पहली बार साइट बनाने/जोड़ने को पूछेगा)

उपयोग
 * होस्ट:    https://<आपकी-साइट>.netlify.app/host.html  (प्रोजेक्टर/बड़ी स्क्रीन पर)
 * खिलाड़ी:  https://<आपकी-साइट>.netlify.app/          (मोबाइल पर PIN डालकर)
 * होस्ट पेज को सबके सामने न खोलें/लिंक साझा न करें, ताकि प्रश्न-उत्तर खिलाड़ियों को न दिखें।

फाइलें
 public/questions.js          — सभी 811 प्रश्न
 public/photo-questions.json  — फोटो पहचान के प्रश्न (img/ में असली फोटो रखें, देखें img/README.txt)
 netlify/functions/api.mjs    — गेम का सर्वर (Netlify Blobs; किसी बाहरी key की ज़रूरत नहीं)
