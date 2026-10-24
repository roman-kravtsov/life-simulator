// Given names for the person and family (CHAR-002). Written for this project, not copied from
// any other game or list. Each group covers one or more UN regions (the `region` field of the
// country files) and holds at least 40 names per sex, in Latin letters. Names are given names
// that are common in the region today; surnames are not used.

export interface NameList {
  female: readonly string[];
  male: readonly string[];
}

const split = (names: string) => names.split(/\s+/).filter(Boolean);
const list = (female: string, male: string): NameList => ({ female: split(female), male: split(male) });

export const NAME_LISTS: Readonly<Record<string, NameList>> = {
  "western-africa": list(
    `Amina Fatou Aissatou Adjoa Abena Akosua Ama Efua Yaa Chioma Ngozi Adaeze Folake Bukola Funmilayo Titilayo
     Aminata Mariama Kadiatou Awa Rokia Fanta Hawa Safiatou Zainab Khadija Nana Esi Afia Ifeoma Amara Yewande
     Temitope Kehinde Oluchi Nkechi Hauwa Binta Maimouna Salamata Adwoa`,
    `Kwame Kofi Kwabena Yaw Kojo Kwesi Ibrahim Moussa Mamadou Ousmane Abdoulaye Seydou Sekou Bakary Modibo Issa
     Chidi Emeka Obinna Chukwuemeka Ifeanyi Tunde Segun Adebayo Olumide Babatunde Musa Garba Usman Sani
     Alhassan Yakubu Amadou Boubacar Cheikh Lamine Samba Idrissa Souleymane Mensah`,
  ),
  "eastern-africa": list(
    `Amani Zawadi Neema Upendo Imani Furaha Asha Halima Mwajuma Rehema Wanjiru Njeri Akinyi Atieno Achieng Nyambura
     Wambui Chebet Jeruto Makena Alemnesh Tigist Selam Meron Hanna Rahel Birtukan Mulu Aster Kidist Claudine
     Divine Uwimana Aline Josiane Grace Esther Mercy Joyce Faith`,
    `Juma Hamisi Baraka Jabari Salim Omari Bakari Rashidi Kamau Otieno Odhiambo Kipchoge Kiprop Mwangi Kariuki
     Wafula Abebe Bekele Dawit Haile Getachew Tesfaye Yonas Mulugeta Samuel Eliud Joseph Peter Emmanuel
     Jean Eric Patrick Claude Theogene Innocent Faustin Mugisha Okello Ssemakula Kato`,
  ),
  "middle-africa": list(
    `Mireille Solange Chantal Nadege Ghislaine Prisca Francine Berthe Clarisse Estelle Nicole Beatrice Edwige Maguy
     Marie Pauline Rosalie Odette Clementine Albertine Brigitte Josephine Charlotte Henriette Colette Yvette
     Amelie Sylvie Therese Delphine Honorine Arlette Blandine Viviane Carine Alphonsine Lucie Mbala Nzinga Ornella`,
    `Jean-Pierre Patrice Serge Fabrice Cedric Landry Rodrigue Gaspard Boniface Come Dieudonne Evariste Ghislain
     Hermann Isidore Joel Kevin Lazare Maxime Narcisse Olivier Parfait Roger Sylvain Thierry Urbain Valentin
     Wilfried Yannick Alain Blaise Christian Didier Faustin Gilbert Honore Aime Mbemba Nkosi Pascal`,
  ),
  "southern-africa": list(
    `Thandiwe Nomvula Lerato Palesa Naledi Zanele Nokuthula Busisiwe Thabisa Lindiwe Ayanda Sipho Nandi Khanyisile
     Refilwe Mpho Dineo Kefilwe Boitumelo Masego Neo Tshepiso Karabo Onalenna Amogelang Ntombi Zodwa Precious
     Gift Memory Fadzai Rudo Tendai Chipo Nyasha Tsitsi Ruvimbo Vimbai Anesu Rutendo`,
    `Sipho Thabo Themba Bongani Mandla Lwazi Sizwe Tshepo Kagiso Lesedi Katlego Tumelo Mpho Kabelo Tebogo
     Lunga Siyabonga Nkosinathi Mthunzi Vusi Jabu Kgosi Gorata Itumeleng Neo Tendai Tafadzwa Farai Takudzwa
     Tinashe Simba Blessing Tatenda Kudzai Munashe Chengetai Rufaro Wellington Mogomotsi Thulani`,
  ),
  "north-africa-west-asia": list(
    `Fatima Maryam Layla Noor Salma Yasmin Amal Huda Samira Rania Dina Hana Leila Nadia Zeinab Aisha Khadija
     Sara Mona Amira Lina Reem Farah Ghada Hiba Ayse Elif Zeynep Fatma Merve Shirin Roya Narges Mahsa
     Tamar Maya Nare Mariam Ani Rima`,
    `Mohamed Ahmed Ali Omar Youssef Karim Hassan Hussein Khaled Tarek Samir Walid Nabil Ibrahim Yahya
     Bilal Amir Rami Faris Saeed Mehmet Mustafa Emre Burak Hakan Murat Kemal Reza Hamid Mahdi Davood Arash
     Dani Avi Yossi Levon Armen Tigran Nika Giorgi`,
  ),
  "south-asia": list(
    `Priya Anjali Sunita Kavita Meena Lakshmi Radha Sita Geeta Pooja Neha Divya Ananya Aditi Shreya Ishita
     Fatima Ayesha Nasreen Shabnam Rukhsana Sana Hina Mehwish Farzana Rabia Sultana Taslima Nusrat Jahanara
     Parvati Sangita Rekha Usha Bimala Kamala Sushila Maya Sabitri Rukmini`,
    `Rahul Amit Vijay Sanjay Ravi Suresh Rajesh Anil Manoj Deepak Arjun Rohan Vikram Karthik Krishna Gopal
     Mohammad Imran Bilal Usman Hamza Asif Tariq Zubair Rafiq Salman Karim Rahim Habib Jamal Nazrul
     Bikash Sunil Prakash Ramesh Dinesh Hari Bishnu Kamal Naresh`,
  ),
  "central-asia": list(
    `Aigul Dilnoza Gulnara Madina Zarina Aziza Malika Nilufar Shahnoza Sevara Aliya Aizhan Dana Saltanat Asel
     Aida Gulmira Zhanna Altynai Kamila Nigora Feruza Mohira Dilorom Gulchehra Mavluda Oltin Sabina Lola
     Zulfiya Barno Nargiza Rano Sitora Mukhabbat Aynur Jamila Gulshan Zebo Nodira`,
    `Bakhtiyor Farrukh Jasur Rustam Timur Sardor Akmal Bobur Dostonbek Aziz Nurlan Askar Daulet Yerlan Marat
     Serik Bauyrzhan Arman Kanat Asylbek Bolot Ermek Nursultan Talgat Azamat Aibek Eldar Jamshid Sherzod
     Ulugbek Otabek Anvar Ravshan Kamol Firuz Rahmon Emomali Shokir Murod Sanjar`,
  ),
  "east-asia": list(
    `Mei Lan Xiu Ying Hua Jing Li Fang Yan Ling Xin Yu Hui Na Qing Min Sakura Yui Hana Aoi Rin Mio Yuki
     Haruka Emi Keiko Ji-woo Seo-yeon Min-ji Ha-eun Soo-ah Eun-ji Yu-na Bayarmaa Oyun Narantuya Saran Tuya Altantsetseg Oyuna`,
    `Wei Jun Lei Tao Ming Jian Hao Bo Chen Yong Feng Gang Peng Kai Hui Jie Haruto Ren Sora Yuto Kenji Takeshi
     Hiroshi Daiki Sho Minjun Seo-jun Do-yun Ji-ho Joon-woo Hyun-woo Tae-yang Batbayar Enkhbat Ganzorig
     Temuulen Bold Tumur Altan Nyamdorj Chimeg`,
  ),
  "south-eastern-asia": list(
    `Siti Dewi Putri Sri Ayu Wulan Rina Lestari Nur Intan Maria Angelica Jasmine Bituin Luz Corazon Thao Linh Mai
     Hoa Lan Nga Malee Somchai Suda Pimchai Napa Kanya Srey Sokha Chantha Bopha Daw Khin Thandar Hnin Aye Nang Mya Ei`,
    `Budi Agus Wayan Joko Bayu Dimas Rizky Andi Ahmad Muhammad Jose Juan Mark Paolo Carlo Rodel Nguyen Minh
     Tuan Hung Duc Quang Somsak Prasert Anan Krit Chai Vichai Sophea Dara Vannak Sokun Kyaw Aung Zaw Min
     Htet Ko Tun Win`,
  ),
  "western-northern-europe": list(
    `Emma Olivia Charlotte Amelia Sophie Grace Hannah Emily Lucy Chloe Anna Clara Marie Lena Julia Sarah Laura
     Isla Freya Ella Ruby Maja Astrid Ingrid Sofie Nora Ida Elin Greta Hanne Liv Katrine Annika Louise Signe
     Camille Margaux Eva Mila Jade`,
    `Oliver Jack Noah Harry George Leo Arthur Thomas William James Henry Lucas Ethan Liam Oscar Jonas Felix
     Paul Max Emil Axel Anders Lars Sven Nils Erik Magnus Hugo Louis Gabriel Antoine Mathis Jan Pieter
     Daan Finn Callum Ewan Declan Rory`,
  ),
  "southern-europe": list(
    `Giulia Sofia Aurora Alice Beatrice Chiara Francesca Martina Elena Lucia Carmen Maria Ana Marta Paula
     Teresa Isabel Rosa Pilar Dolores Irene Eleni Katerina Georgia Despina Ioanna Dimitra Anastasia Ivana
     Marija Jelena Mirela Lejla Ines Mafalda Beatriz Joana Sara Vera Lidia`,
    `Francesco Alessandro Lorenzo Matteo Andrea Marco Giuseppe Luca Davide Paolo Antonio Javier Pablo Alvaro
     Carlos Miguel Jorge David Sergio Manuel Joao Tiago Rui Nuno Duarte Dimitris Nikos Giorgos Kostas
     Yannis Panagiotis Marko Ivan Luka Ante Josip Dario Mehmed Stefan Filip`,
  ),
  "eastern-europe": list(
    `Anna Maria Olga Natalia Irina Svetlana Tatiana Elena Katya Dasha Oksana Yulia Halyna Iryna Sofiia Zofia
     Katarzyna Agnieszka Magdalena Marta Jana Eva Lucie Tereza Katalin Zsuzsa Ilona Eszter Ioana Eleonora
     Andreea Mihaela Raisa Vera Nadia Liliya Dobromira Gergana Zlatka Milena`,
    `Ivan Dmitri Sergei Alexei Andrei Mikhail Nikolai Vladimir Pavel Oleg Taras Bohdan Andriy Oleksandr
     Dmytro Piotr Jakub Marek Tomasz Michal Pawel Jan Martin Tomas Lukas Laszlo Istvan Gabor Zoltan Balazs
     Mihai Cristian Radu Bogdan Georgi Petar Stoyan Todor Viktor Roman`,
  ),
  "latin-america-caribbean": list(
    `Valentina Camila Isabella Lucia Mariana Gabriela Daniela Fernanda Paola Catalina Ximena Renata Rosa
     Guadalupe Maribel Yesenia Karla Lupita Beatriz Luciana Larissa Thais Aline Juliana Vitoria Marisol
     Esperanza Altagracia Yolanda Nayeli Citlali Ines Maite Flor Dayana Yaritza Shanice Keisha Marlene Josefina`,
    `Santiago Mateo Sebastian Diego Nicolas Alejandro Emiliano Joaquin Leonardo Bruno Juan Luis Jose Carlos
     Jorge Pedro Miguel Rafael Andres Felipe Gustavo Thiago Lucas Gabriel Rodrigo Matheus Eduardo Ricardo
     Wilmer Yeison Jair Ismael Abel Dwayne Kemar Jermaine Anselmo Ernesto Hector Esteban`,
  ),
  oceania: list(
    `Mere Aroha Hine Anahera Moana Tui Leilani Mele Losa Salote Sina Lupe Ana Talia Ioane Vaea Teuila Fiafia
     Lani Kalea Malia Nia Tia Wiremu Maria Elisapeta Jenny Rosa Selina Hana Lesieli Seini Akanisi Vika
     Eleni Dolly Nancy Gloria Kiri Leah`,
    `Wiremu Tane Rangi Manu Kahu Hemi Aroha Sione Mikaele Tevita Viliami Sefo Tui Lemi Fetu Joseph Peter
     John Paul Michael Samuel Isaac Jacob Noa Josaia Ratu Semi Epeli Inoke Apisai Kaliopate Koro Maka
     Taka Kauri Nikau Ioane Tavita Laki Mika`,
  ),
};

/** Which name group each UN region uses. */
export const REGION_NAME_GROUP: Readonly<Record<string, keyof typeof NAME_LISTS>> = {
  "Western Africa": "western-africa",
  "Eastern Africa": "eastern-africa",
  "Middle Africa": "middle-africa",
  "Southern Africa": "southern-africa",
  "Northern Africa": "north-africa-west-asia",
  "Western Asia": "north-africa-west-asia",
  "Southern Asia": "south-asia",
  "Central Asia": "central-asia",
  "Eastern Asia": "east-asia",
  "South-Eastern Asia": "south-eastern-asia",
  "Western Europe": "western-northern-europe",
  "Northern Europe": "western-northern-europe",
  "Northern America": "western-northern-europe",
  "Australia/New Zealand": "western-northern-europe",
  "Southern Europe": "southern-europe",
  "Eastern Europe": "eastern-europe",
  "Central America": "latin-america-caribbean",
  "South America": "latin-america-caribbean",
  Caribbean: "latin-america-caribbean",
  Melanesia: "oceania",
  Micronesia: "oceania",
  Polynesia: "oceania",
};

/** The name list for a region. Throws for a region without one, so a new region cannot slip through. */
export function namesForRegion(region: string): NameList {
  const group = REGION_NAME_GROUP[region];
  if (!group) throw new Error(`No name list for region: ${region}`);
  return NAME_LISTS[group]!;
}
