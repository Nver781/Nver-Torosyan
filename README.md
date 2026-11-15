# Գիտելիքի կենտրոն

Լեզուների, Կապիտալի, IT, թրեյդինգի և Project Management ակադեմիաներ մեկ կայքում՝ քննություններով, վկայականներով և AI ուսուցչով։

## Կառուցվածք

```
.
├── server.js              # Node սերվեր․ ստատիկ ֆայլեր + /api/sample (AI պրոքսի)
├── package.json           # npm start → node server.js (արտաքին dependency չկա)
├── render.yaml            # Render Blueprint (մեկ սեղմումով տեղադրում)
├── .env.example           # Միջավայրի փոփոխականների օրինակ
├── scripts/check.js       # npm run check → JS սինտաքսի ստուգում
└── public/
    ├── index.html         # Գլխավոր էջ (կենտրոն)
    ├── languages.html     # Լեզուների աշխատանոց (EN · RU · TR)
    ├── capital.html       # Կապիտալի ակադեմիա
    ├── it.html            # IT ակադեմիա
    ├── trading.html       # Թրեյդինգի ակադեմիա
    ├── pm.html            # Project Management ակադեմիա
    ├── data/signals.js    # Կրիպտո ազդանշանների տվյալներ (թարմացվում են առանձին)
    └── js/claude-shim.js  # AI ֆունկցիաների կապը սերվերի հետ
```

## Ինչպես է աշխատում AI-ը

Էջերը AI-ին դիմում են `window.claude.use("sample")`-ով։ `js/claude-shim.js`-ը այդ կանչերն ուղարկում է քո սերվերի `/api/sample` հասցեին, իսկ սերվերը՝ Anthropic API-ին։ **API բանալին մնում է միայն սերվերում** և երբեք չի հասնում բրաուզերին։

Եթե `ANTHROPIC_API_KEY`-ը տեղադրված չէ, կայքն աշխատում է ամբողջությամբ, բայց AI բաժինները (պարզ բացատրություն, հարց-պատասխան, AI թեստեր, գնահատում, հարցազրույց) թաքնվում են։

Առաջընթացը պահվում է օգտատիրոջ բրաուզերում (`localStorage`)։ Եթե մարդը փոխի սարքը կամ մաքրի բրաուզերը, առաջընթացը չի պահպանվի։

## Լոկալ գործարկում

```bash
cp .env.example .env        # լրացրու ANTHROPIC_API_KEY
export $(cat .env | xargs)  # կամ սահմանիր փոփոխականները ձեռքով
npm start                   # http://localhost:3000
npm run check               # սինտաքսի ստուգում
```

Պահանջվում է Node.js 18 կամ ավելի նոր։

## Տեղադրում GitHub + Render

1. GitHub-ում ստեղծիր նոր repository (կարող է լինել private) և վերբեռնիր այս թղթապանակի պարունակությունը.
   ```bash
   git init
   git add .
   git commit -m "Գիտելիքի կենտրոն"
   git branch -M main
   git remote add origin https://github.com/<քո-username>/<repo>.git
   git push -u origin main
   ```
2. Render-ում (render.com) ընտրիր **New → Blueprint**, միացրու GitHub-ը և ընտրիր repository-ն։ Render-ը կկարդա `render.yaml`-ը։
   Այլընտրանք՝ **New → Web Service**, Runtime՝ Node, Build command՝ `echo no build step`, Start command՝ `node server.js`։
3. Environment բաժնում ավելացրու `ANTHROPIC_API_KEY` (բանալին ստացիր console.anthropic.com-ում)։
4. Deploy-ից հետո բացիր `https://<անուն>.onrender.com/healthz`։ Պետք է տեսնես `{"ok":true,"ai":true}`։

Ամեն `git push` main ճյուղին ավտոմատ նորից կտեղադրի կայքը (`autoDeploy: true`)։

### Կարգավորումներ

| Փոփոխական | Լռելյայն | Նշանակություն |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Պարտադիր է AI-ի համար |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Մոդելը |
| `MAX_TOKENS` | `2000` | Պատասխանի առավելագույն երկարություն |
| `RATE_PER_HOUR` | `60` | AI հարցումներ մեկ IP-ից մեկ ժամում |

## Ծախսեր և անվտանգություն

- Render-ի անվճար պլանում սերվերը «քնում» է անգործությունից հետո. առաջին բացումը կարող է տևել 30–60 վայրկյան։ Մշտական աշխատանքի համար ընտրիր վճարովի պլան։
- Anthropic API-ն վճարովի է ըստ օգտագործման։ Console-ում սահմանիր ամսական ծախսի սահմանաչափ։
- Եթե կայքը հանրային է, ցանկացած այցելու կարող է օգտագործել AI-ը քո բանալիով։ `RATE_PER_HOUR`-ը սահմանափակում է չարաշահումը, բայց մուտքի պաշտպանության համար կարող ես Render-ում ավելացնել գաղտնաբառ կամ կայքը պահել փակ։

## Կրիպտո ազդանշանների թարմացում

Ազդանշանները գտնվում են `public/data/signals.js` ֆայլում։ Թարմացնելու համար փոխիր `DATA` օբյեկտը (նույն կառուցվածքով), ստուգիր `npm run check`-ով և արա `git push`։ Render-ը ավտոմատ կթարմացնի կայքը։

## Ծանուցում

Թրեյդինգի և ֆինանսների նյութերը կրթական են և անհատական ներդրումային խորհուրդ չեն։ Վկայականները հավաստում են ինքնուսուցման ծրագրի ավարտը և պաշտոնական սերտիֆիկատներ չեն։
