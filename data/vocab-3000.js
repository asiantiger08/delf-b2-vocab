(function () {
  const TARGET_TOTAL = 3200;
  const categories = window.B2_CATEGORY_ORDER || [
    "Le monde du travail",
    "L'environnement",
    "La technologie",
    "L'éducation",
    "La santé",
    "Les médias et l'information",
    "La société et les inégalités",
    "La mondialisation"
  ];

  const verbs = [
    ["analyser", "分析"], ["aborder", "处理/讨论"], ["améliorer", "改善"], ["renforcer", "加强"],
    ["réduire", "减少"], ["favoriser", "促进"], ["prévenir", "预防"], ["limiter", "限制"],
    ["encourager", "鼓励"], ["développer", "发展"], ["protéger", "保护"], ["garantir", "保障"],
    ["remettre en question", "质疑"], ["mettre en place", "建立/实施"], ["prendre en compte", "考虑到"],
    ["faire face à", "面对"], ["sensibiliser à", "提高对……的意识"], ["lutter contre", "对抗"],
    ["s'adapter à", "适应"], ["avoir recours à", "求助于/使用"], ["mettre en évidence", "突出"],
    ["souligner", "强调"], ["évaluer", "评估"], ["transformer", "改变"]
  ];

  const adjectives = [
    ["durable", "可持续的"], ["structurel", "结构性的"], ["éthique", "伦理的"], ["collectif", "集体的"],
    ["individuel", "个人的"], ["social", "社会的"], ["économique", "经济的"], ["écologique", "生态的"],
    ["numérique", "数字的"], ["professionnel", "职业的"], ["culturel", "文化的"], ["sanitaire", "卫生/健康的"]
  ];

  const themes = {
    "Le monde du travail": {
      zh: "工作世界",
      nouns: [
        ["le marché du travail", "劳动力市场"], ["la recherche d'emploi", "求职"], ["la sécurité de l'emploi", "就业安全"],
        ["la flexibilité professionnelle", "职业灵活性"], ["la mobilité professionnelle", "职业流动"], ["la reconversion professionnelle", "职业转型"],
        ["la qualité de vie au travail", "工作生活质量"], ["la charge de travail", "工作负荷"], ["le stress professionnel", "职业压力"],
        ["l'épuisement professionnel", "职业倦怠"], ["la motivation des salariés", "员工积极性"], ["la négociation salariale", "薪资谈判"],
        ["l'égalité salariale", "薪资平等"], ["le contrat précaire", "不稳定合同"], ["le travail indépendant", "自由职业"],
        ["la formation en entreprise", "企业培训"], ["la compétence linguistique", "语言能力"], ["la compétence numérique", "数字能力"],
        ["l'esprit d'équipe", "团队精神"], ["la prise d'initiative", "主动性"], ["la gestion du temps", "时间管理"],
        ["le recrutement", "招聘"], ["l'entretien d'embauche", "求职面试"], ["la période d'essai", "试用期"],
        ["la hiérarchie", "等级关系"], ["le management participatif", "参与式管理"], ["le droit du travail", "劳动法"],
        ["la grève", "罢工"], ["le syndicat", "工会"], ["la productivité", "生产率"], ["la retraite", "退休"],
        ["l'équilibre vie privée-vie professionnelle", "工作与私人生活平衡"]
      ]
    },
    "L'environnement": {
      zh: "环境",
      nouns: [
        ["la pollution atmosphérique", "空气污染"], ["la pollution sonore", "噪音污染"], ["la qualité de l'air", "空气质量"],
        ["la qualité de l'eau", "水质"], ["la gestion des déchets", "垃圾管理"], ["le tri sélectif", "分类回收"],
        ["le recyclage", "回收"], ["la sobriété énergétique", "能源节制"], ["la consommation responsable", "负责任消费"],
        ["l'agriculture biologique", "有机农业"], ["les circuits courts", "短供应链"], ["la protection des espèces", "物种保护"],
        ["la disparition des espèces", "物种消失"], ["les espaces verts", "绿地"], ["la mobilité douce", "绿色出行"],
        ["les transports publics", "公共交通"], ["la rénovation énergétique", "能源改造"], ["la ressource naturelle", "自然资源"],
        ["la sécheresse", "干旱"], ["l'inondation", "洪水"], ["la canicule", "热浪"], ["la montée des eaux", "海平面上升"],
        ["le changement climatique", "气候变化"], ["la neutralité carbone", "碳中和"], ["l'énergie solaire", "太阳能"],
        ["l'énergie éolienne", "风能"], ["la biodiversité locale", "本地生物多样性"], ["la forêt", "森林"],
        ["la déforestation", "森林砍伐"], ["l'économie d'eau", "节水"], ["le gaspillage alimentaire", "食物浪费"],
        ["la responsabilité environnementale", "环境责任"]
      ]
    },
    "La technologie": {
      zh: "科技",
      nouns: [
        ["la révolution numérique", "数字革命"], ["la sécurité informatique", "网络安全"], ["la cybersécurité", "网络安全"],
        ["la vie privée en ligne", "线上隐私"], ["la collecte de données", "数据收集"], ["le consentement numérique", "数字同意"],
        ["la reconnaissance faciale", "人脸识别"], ["la voiture autonome", "自动驾驶汽车"], ["l'automatisation", "自动化"],
        ["la robotisation", "机器人化"], ["le commerce en ligne", "电子商务"], ["le paiement sans contact", "非接触支付"],
        ["la télémédecine", "远程医疗"], ["l'application mobile", "手机应用"], ["la plateforme numérique", "数字平台"],
        ["le réseau social", "社交网络"], ["l'identité numérique", "数字身份"], ["la réalité virtuelle", "虚拟现实"],
        ["la réalité augmentée", "增强现实"], ["le logiciel libre", "自由软件"], ["la mise à jour", "更新"],
        ["la panne informatique", "电脑故障"], ["la dépendance aux écrans", "屏幕依赖"], ["la concentration en ligne", "线上注意力"],
        ["la traçabilité", "可追踪性"], ["le progrès technique", "技术进步"], ["la recherche scientifique", "科学研究"],
        ["l'éthique numérique", "数字伦理"], ["la souveraineté numérique", "数字主权"], ["la modération des contenus", "内容审核"],
        ["la bulle de filtres", "信息茧房"], ["le biais algorithmique", "算法偏见"]
      ]
    },
    "L'éducation": {
      zh: "教育",
      nouns: [
        ["la réussite scolaire", "学业成功"], ["l'échec scolaire", "学业失败"], ["l'orientation scolaire", "升学指导"],
        ["l'autonomie des élèves", "学生自主性"], ["la motivation des élèves", "学生动机"], ["la pédagogie active", "主动式教学"],
        ["l'évaluation continue", "持续评价"], ["l'examen final", "期末考试"], ["la classe inversée", "翻转课堂"],
        ["l'inclusion scolaire", "教育包容"], ["le soutien scolaire", "课业辅导"], ["les devoirs à la maison", "家庭作业"],
        ["la mémorisation", "记忆"], ["la prise de parole", "发言"], ["la compréhension orale", "听力理解"],
        ["l'expression écrite", "书面表达"], ["l'expression orale", "口语表达"], ["la culture générale", "通识文化"],
        ["la lecture critique", "批判性阅读"], ["l'enseignement supérieur", "高等教育"], ["la formation initiale", "初始教育"],
        ["l'apprentissage tout au long de la vie", "终身学习"], ["la bourse d'études", "奖学金"], ["les frais d'inscription", "注册费"],
        ["la sélection à l'université", "大学选拔"], ["la relation enseignant-élève", "师生关系"], ["le climat scolaire", "校园氛围"],
        ["le harcèlement scolaire", "校园霸凌"], ["la discipline", "纪律"], ["la curiosité intellectuelle", "求知欲"],
        ["la méthode de travail", "学习方法"], ["la confiance en soi", "自信"]
      ]
    },
    "La santé": {
      zh: "健康",
      nouns: [
        ["la santé publique", "公共卫生"], ["la médecine préventive", "预防医学"], ["la santé mentale", "心理健康"],
        ["l'anxiété", "焦虑"], ["la dépression", "抑郁"], ["le sommeil", "睡眠"], ["l'activité physique", "体育活动"],
        ["l'alimentation équilibrée", "均衡饮食"], ["la consommation de sucre", "糖摄入"], ["la dépendance au tabac", "烟草依赖"],
        ["la consommation d'alcool", "酒精消费"], ["le dépistage", "筛查"], ["la vaccination", "疫苗接种"],
        ["la prise en charge", "照护/承担治疗"], ["le médecin généraliste", "全科医生"], ["le spécialiste", "专科医生"],
        ["l'hôpital public", "公立医院"], ["les urgences", "急诊"], ["le remboursement des soins", "医疗报销"],
        ["la mutuelle", "补充医保"], ["le dossier médical", "医疗档案"], ["la douleur chronique", "慢性疼痛"],
        ["le vieillissement", "老龄化"], ["la dépendance des personnes âgées", "老年人失能"], ["l'aide à domicile", "居家护理"],
        ["la qualité des soins", "医疗质量"], ["la pénurie de médecins", "医生短缺"], ["la télésanté", "远程健康服务"],
        ["le parcours de soins", "就医路径"], ["l'éducation à la santé", "健康教育"], ["le rythme de vie", "生活节奏"],
        ["la fatigue", "疲劳"]
      ]
    },
    "Les médias et l'information": {
      zh: "媒体与信息",
      nouns: [
        ["le traitement de l'information", "信息处理"], ["la vérification des faits", "事实核查"], ["la rumeur", "谣言"],
        ["la propagande", "宣传操控"], ["la censure", "审查"], ["l'indépendance des médias", "媒体独立"],
        ["le journalisme d'investigation", "调查新闻"], ["la ligne éditoriale", "编辑方针"], ["la couverture médiatique", "媒体报道"],
        ["l'opinion publique", "公众舆论"], ["le débat public", "公共讨论"], ["la polarisation", "两极化"],
        ["le temps d'écran", "屏幕时间"], ["l'attention du public", "公众注意力"], ["le titre accrocheur", "吸睛标题"],
        ["le sensationnalisme", "煽情主义"], ["la publicité ciblée", "定向广告"], ["l'influenceur", "网红/意见领袖"],
        ["la recommandation automatique", "自动推荐"], ["la modération", "审核"], ["la liberté d'expression", "言论自由"],
        ["le droit à l'information", "知情权"], ["le secret des sources", "消息来源保密"], ["la confiance dans les médias", "对媒体的信任"],
        ["le pluralisme politique", "政治多元主义"], ["la source officielle", "官方来源"], ["la source indépendante", "独立来源"],
        ["la manipulation de l'image", "图像操纵"], ["la viralité", "病毒式传播"], ["l'esprit critique", "批判性思维"],
        ["l'éducation aux médias", "媒体素养教育"], ["la désinformation en ligne", "线上虚假信息"]
      ]
    },
    "La société et les inégalités": {
      zh: "社会与不平等",
      nouns: [
        ["la justice sociale", "社会正义"], ["l'ascenseur social", "社会上升通道"], ["la pauvreté", "贫困"],
        ["la pauvreté infantile", "儿童贫困"], ["la précarité énergétique", "能源贫困"], ["le logement social", "社会住房"],
        ["la crise du logement", "住房危机"], ["la ségrégation urbaine", "城市隔离"], ["le quartier défavorisé", "弱势社区"],
        ["l'accès à la culture", "文化可及性"], ["l'accès au logement", "住房可及性"], ["l'accès à l'emploi", "就业机会"],
        ["la discrimination à l'embauche", "招聘歧视"], ["la discrimination de genre", "性别歧视"], ["l'égalité femmes-hommes", "男女平等"],
        ["la diversité sociale", "社会多样性"], ["l'intégration des migrants", "移民融入"], ["la cohésion nationale", "国家凝聚力"],
        ["la participation citoyenne", "公民参与"], ["le bénévolat associatif", "协会志愿服务"], ["la solidarité intergénérationnelle", "代际互助"],
        ["l'isolement social", "社会孤立"], ["la solitude", "孤独"], ["le lien social", "社会纽带"],
        ["la mixité sociale", "社会混合"], ["la fracture territoriale", "地域差距"], ["les droits fondamentaux", "基本权利"],
        ["la dignité humaine", "人的尊严"], ["la citoyenneté active", "积极公民意识"], ["la laïcité", "世俗原则"],
        ["le racisme", "种族主义"], ["les préjugés sociaux", "社会偏见"]
      ]
    },
    "La mondialisation": {
      zh: "全球化",
      nouns: [
        ["le commerce international", "国际贸易"], ["la concurrence mondiale", "全球竞争"], ["la chaîne d'approvisionnement", "供应链"],
        ["la dépendance économique", "经济依赖"], ["la coopération internationale", "国际合作"], ["la gouvernance mondiale", "全球治理"],
        ["la crise migratoire", "移民危机"], ["les flux migratoires", "移民流动"], ["la circulation des idées", "思想流通"],
        ["la circulation des marchandises", "商品流通"], ["la diffusion culturelle", "文化传播"], ["la diversité linguistique", "语言多样性"],
        ["l'identité culturelle", "文化身份"], ["la culture locale", "地方文化"], ["la marque mondiale", "全球品牌"],
        ["le tourisme de masse", "大众旅游"], ["le choc culturel", "文化冲击"], ["l'ouverture économique", "经济开放"],
        ["la fermeture des frontières", "边境关闭"], ["les droits humains", "人权"], ["la solidarité internationale", "国际互助"],
        ["la diplomatie", "外交"], ["le conflit commercial", "贸易冲突"], ["la taxe douanière", "关税"],
        ["l'entreprise multinationale", "跨国公司"], ["la relocalisation", "产业回流"], ["la spécialisation économique", "经济专业化"],
        ["la dépendance énergétique", "能源依赖"], ["la crise mondiale", "全球危机"], ["l'influence culturelle", "文化影响"],
        ["la coopération scientifique", "科学合作"], ["l'interdépendance des pays", "国家间相互依赖"]
      ]
    }
  };

  function normalize(text) {
    return String(text || "").toLowerCase().trim();
  }

  const categoryUsage = {
    "Le monde du travail": {
      field: "le monde professionnel",
      issue: "l'organisation du travail, les compétences ou la stabilité de l'emploi",
      action: "améliorer les conditions de travail",
      zhIssue: "工作组织、职业能力或就业稳定",
      zhAction: "改善工作条件"
    },
    "L'environnement": {
      field: "la protection de l'environnement",
      issue: "la consommation des ressources, la pollution ou la transition écologique",
      action: "réduire l'impact écologique",
      zhIssue: "资源消耗、污染或生态转型",
      zhAction: "减少生态影响"
    },
    "La technologie": {
      field: "les usages du numérique",
      issue: "l'innovation, la sécurité ou les effets des technologies sur la société",
      action: "adapter les outils aux besoins réels",
      zhIssue: "创新、安全或技术对社会的影响",
      zhAction: "让工具适应真实需求"
    },
    "L'éducation": {
      field: "le système éducatif",
      issue: "l'apprentissage, l'égalité des chances ou la réussite scolaire",
      action: "mieux accompagner les élèves",
      zhIssue: "学习、机会平等或学业成功",
      zhAction: "更好地支持学生"
    },
    "La santé": {
      field: "la santé publique",
      issue: "la prévention, l'accès aux soins ou l'hygiène de vie",
      action: "protéger la santé des individus",
      zhIssue: "预防、医疗可及性或健康生活方式",
      zhAction: "保护个人健康"
    },
    "Les médias et l'information": {
      field: "l'information publique",
      issue: "la fiabilité des sources, la liberté de la presse ou la manipulation",
      action: "mieux comprendre l'actualité",
      zhIssue: "信息来源可靠性、新闻自由或操纵",
      zhAction: "更好地理解时事"
    },
    "La société et les inégalités": {
      field: "la vie sociale",
      issue: "l'exclusion, la discrimination ou la cohésion sociale",
      action: "renforcer la justice sociale",
      zhIssue: "排斥、歧视或社会凝聚力",
      zhAction: "加强社会正义"
    },
    "La mondialisation": {
      field: "les relations internationales",
      issue: "les échanges, les dépendances économiques ou la diversité culturelle",
      action: "comprendre les interdépendances entre pays",
      zhIssue: "交流、经济依赖或文化多样性",
      zhAction: "理解国家之间的相互依赖"
    }
  };

  const specificDefinitions = {
    "le recyclage": "Action de récupérer et de transformer des déchets afin de réutiliser leurs matières au lieu de les jeter.",
    "la sobriété énergétique": "Principe qui consiste à réduire volontairement la consommation d'énergie en évitant les usages inutiles.",
    "la consommation responsable": "Manière d'acheter et d'utiliser des produits en tenant compte de leurs effets sociaux et environnementaux.",
    "l'agriculture biologique": "Mode de production agricole qui limite les produits chimiques de synthèse et respecte davantage les sols, les animaux et les écosystèmes.",
    "le gaspillage alimentaire": "Fait de jeter ou de perdre de la nourriture qui aurait encore pu être consommée.",
    "la biodiversité locale": "Ensemble des espèces animales, végétales et microbiennes présentes dans un territoire donné.",
    "la pollution atmosphérique": "Présence dans l'air de substances nocives pour la santé humaine et pour l'environnement.",
    "le tri sélectif": "Séparation des déchets selon leur matière afin de faciliter leur recyclage ou leur traitement.",
    "la mobilité douce": "Modes de déplacement peu polluants, comme la marche, le vélo ou certains transports partagés."
  };

  const specificExamples = {
    "le recyclage": [
      { fr: "Le recyclage du verre permet de fabriquer de nouvelles bouteilles sans extraire autant de matières premières.", zh: "玻璃回收可以制造新瓶子，而不必开采那么多原材料。" },
      { fr: "Dans mon immeuble, un bac jaune est réservé au recyclage du papier et des emballages.", zh: "在我住的楼里，黄色垃圾桶专门用于纸张和包装回收。" },
      { fr: "Le recyclage ne suffit pas si l'on continue à produire trop de déchets.", zh: "如果继续制造过多垃圾，光靠回收是不够的。" }
    ],
    "la sobriété énergétique": [
      { fr: "La sobriété énergétique consiste par exemple à moins chauffer les bureaux en hiver.", zh: "能源节制例如包括冬天减少办公室供暖。" },
      { fr: "Une ville peut encourager la sobriété énergétique en rénovant l'éclairage public.", zh: "城市可以通过改造公共照明来鼓励能源节制。" },
      { fr: "La sobriété énergétique demande de distinguer les besoins essentiels des usages superflus.", zh: "能源节制要求区分基本需求和多余用途。" }
    ],
    "la consommation responsable": [
      { fr: "Acheter un produit réparable plutôt qu'un objet jetable relève de la consommation responsable.", zh: "购买可维修产品而不是一次性物品，属于负责任消费。" },
      { fr: "La consommation responsable pousse les clients à vérifier l'origine des vêtements.", zh: "负责任消费促使顾客核查服装产地。" },
      { fr: "Même avec un petit budget, on peut pratiquer la consommation responsable en évitant le gaspillage.", zh: "即使预算不高，也可以通过避免浪费来进行负责任消费。" }
    ],
    "l'agriculture biologique": [
      { fr: "L'agriculture biologique interdit la plupart des pesticides chimiques de synthèse.", zh: "有机农业禁止使用大多数化学合成农药。" },
      { fr: "Certains consommateurs choisissent l'agriculture biologique pour protéger les sols et la santé.", zh: "一些消费者选择有机农业，是为了保护土壤和健康。" },
      { fr: "L'agriculture biologique peut coûter plus cher, mais elle répond à une demande écologique.", zh: "有机农业成本可能更高，但它回应了生态需求。" }
    ]
  };

  function cleanTerm(fr) {
    return fr.replace(/^(le|la|les|l'|un|une|des)\s*/i, "").trim();
  }

  function isVerbPhrase(fr) {
    return verbs.some(([verb]) => normalize(fr).startsWith(normalize(verb)));
  }

  function dePhrase(fr) {
    if (/^le\s/i.test(fr)) return fr.replace(/^le\s/i, "du ");
    if (/^les\s/i.test(fr)) return fr.replace(/^les\s/i, "des ");
    return `de ${fr}`.replace("de l'", "de l'");
  }

  function deInfinitive(fr) {
    return /^[aeiouhàâéèêëîïôùûü]/i.test(fr) ? `d'${fr}` : `de ${fr}`;
  }

  function stableIndex(fr, size) {
    let total = 0;
    for (let index = 0; index < fr.length; index += 1) total += fr.charCodeAt(index);
    return total % size;
  }

  function definitionFor(fr, category) {
    const key = normalize(fr);
    if (specificDefinitions[key]) return specificDefinitions[key];
    const usage = categoryUsage[category] || categoryUsage["La société et les inégalités"];
    if (isVerbPhrase(fr)) {
      return `Action qui consiste à ${fr}; on l'emploie pour décrire une démarche concrète dans ${usage.field}.`;
    }
    return `Notion qui désigne ${fr} comme phénomène, pratique ou enjeu dans ${usage.field}.`;
  }

  function chineseDefinitionFor(fr, zh, category) {
    if (isVerbPhrase(fr)) return `表示“${zh}”这一具体动作或处理方式，常用于“${category}”主题的论证。`;
    return `指“${zh}”这一概念、现象或做法，常用于“${category}”主题的说明和分析。`;
  }

  function examplesFor(fr, zh, category) {
    const special = specificExamples[normalize(fr)];
    if (special) return special;
    const usage = categoryUsage[category] || categoryUsage["La société et les inégalités"];
    if (isVerbPhrase(fr)) {
      const verbSets = [
        [
          { fr: `Il faut ${fr} avant de proposer une solution durable.`, zh: `在提出可持续方案之前，必须${zh}。` },
          { fr: `Les responsables cherchent à ${fr} pour ${usage.action}.`, zh: `负责人试图${zh}，以便${usage.zhAction}。` },
          { fr: `Dans une argumentation, ${fr} permet d'aborder ${usage.issue}.`, zh: `在论证中，${zh}可以用来讨论${usage.zhIssue}。` }
        ],
        [
          { fr: `Les experts recommandent ${deInfinitive(fr)} avant de prendre une décision publique.`, zh: `专家建议在作出公共决策前先${zh}。` },
          { fr: `Une association peut ${fr} pour attirer l'attention des citoyens.`, zh: `一个协会可以${zh}，以吸引公民注意。` },
          { fr: `Dans un essai, on peut montrer comment ${fr} change la manière de traiter le problème.`, zh: `在议论文中，可以说明${zh}如何改变处理问题的方式。` }
        ],
        [
          { fr: `Les pouvoirs publics doivent parfois ${fr} malgré des moyens limités.`, zh: `即使资源有限，公共部门有时也必须${zh}。` },
          { fr: `Cette mesure aide à ${fr} sans créer de nouvelles inégalités.`, zh: `这项措施有助于${zh}，同时不制造新的不平等。` },
          { fr: `Pour convaincre le lecteur, l'auteur explique pourquoi il est urgent de ${fr}.`, zh: `为了说服读者，作者解释为什么迫切需要${zh}。` }
        ]
      ];
      return verbSets[stableIndex(fr, verbSets.length)];
    }
    const nounSets = [
      [
        { fr: `Les citoyens parlent ${dePhrase(fr)} lorsqu'ils discutent de ${usage.issue}.`, zh: `当公民讨论${usage.zhIssue}时，会谈到“${zh}”。` },
        { fr: `${capitalize(fr)} influence les choix des familles, des entreprises ou des pouvoirs publics.`, zh: `“${zh}”会影响家庭、企业或公共部门的选择。` },
        { fr: `Une politique efficace doit tenir compte ${dePhrase(fr)} pour ${usage.action}.`, zh: `有效政策必须考虑“${zh}”，以便${usage.zhAction}。` }
      ],
      [
        { fr: `Dans les grandes villes, ${fr} devient un sujet concret pour les habitants.`, zh: `在大城市里，“${zh}”成为居民面对的具体问题。` },
        { fr: `Un rapport récent montre que ${fr} peut modifier les comportements quotidiens.`, zh: `一份近期报告显示，“${zh}”可能改变日常行为。` },
        { fr: `Les associations abordent ${fr} pour sensibiliser le public à ${usage.issue}.`, zh: `协会通过讨论“${zh}”让公众关注${usage.zhIssue}。` }
      ],
      [
        { fr: `À l'école, on peut expliquer ${fr} à partir d'exemples proches de la vie quotidienne.`, zh: `在学校，可以用贴近日常生活的例子解释“${zh}”。` },
        { fr: `Les médias évoquent souvent ${fr} quand une crise révèle des choix collectifs.`, zh: `当危机暴露集体选择时，媒体常提到“${zh}”。` },
        { fr: `Comprendre ${fr} aide à construire une opinion plus nuancée.`, zh: `理解“${zh}”有助于形成更有层次的观点。` }
      ],
      [
        { fr: `Une famille peut être directement concernée par ${fr} dans ses décisions de tous les jours.`, zh: `一个家庭在日常决策中可能会直接受到“${zh}”影响。` },
        { fr: `Les entreprises intègrent progressivement ${fr} dans leur stratégie.`, zh: `企业逐渐把“${zh}”纳入自身策略。` },
        { fr: `Le débat sur ${fr} oppose souvent efficacité économique et responsabilité collective.`, zh: `关于“${zh}”的讨论常常把经济效率与集体责任相对照。` }
      ]
    ];
    return nounSets[stableIndex(fr, nounSets.length)];
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function addEntry(list, seen, fr, zh, category, tag) {
    const key = normalize(fr);
    if (seen.has(key) || !fr || !zh) return;
    seen.add(key);
    list.push({
      fr,
      zh,
      category,
      tags: ["高频", tag || "写作"],
      explanation: {
        fr: definitionFor(fr, category),
        zh: chineseDefinitionFor(fr, zh, category)
      },
      examples: examplesFor(fr, zh, category)
    });
  }

  const existing = window.B2_VOCAB || [];
  const seen = new Set(existing.map(word => normalize(word.fr)));
  const generated = [];
  const targetByCategory = Math.ceil(TARGET_TOTAL / categories.length);
  const categoryCounts = new Map(categories.map(category => [
    category,
    existing.filter(word => word.category === category).length
  ]));

  function categoryHasRoom(category) {
    return (categoryCounts.get(category) || 0) < targetByCategory;
  }

  function addThemedEntry(fr, zh, category, tag) {
    if (!categoryHasRoom(category)) return;
    const before = generated.length;
    addEntry(generated, seen, fr, zh, category, tag);
    if (generated.length > before) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
  }

  for (const category of categories) {
    const theme = themes[category];
    if (!theme) continue;

    for (const [nounFr, nounZh] of theme.nouns) {
      addThemedEntry(nounFr, nounZh, category, "高频");
    }

    for (const [verbFr, verbZh] of verbs) {
      for (const [nounFr, nounZh] of theme.nouns) {
        addThemedEntry(`${verbFr} ${nounFr}`, `${verbZh}${nounZh}`, category, "写作");
        if (!categoryHasRoom(category)) break;
      }
      if (!categoryHasRoom(category)) break;
    }

    for (const [nounFr, nounZh] of theme.nouns) {
      for (const [adjFr, adjZh] of adjectives) {
        addThemedEntry(`${nounFr} ${adjFr}`, `${adjZh}${nounZh}`, category, "写作");
        if (!categoryHasRoom(category)) break;
      }
      if (!categoryHasRoom(category)) break;
    }
  }

  window.B2_VOCAB = existing.concat(generated).slice(0, TARGET_TOTAL);
})();
