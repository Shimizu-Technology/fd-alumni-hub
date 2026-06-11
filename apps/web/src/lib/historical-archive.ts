export type ArchiveArticle = {
  id?: number | string
  year: number
  publishedAt: string | null
  source: string
  title: string
  url: string
  imageUrl: string | null
  excerpt: string | null
}

export type ArchiveMedia = {
  year: number
  source: string
  title: string
  imageUrl: string
  articleUrl?: string | null
  caption?: string | null
  takenAt?: string | null
  tags?: string | null
}

export type ChampionRecord = {
  year: number
  champion?: string
  runnerUp?: string
  score?: string
  source: string
  status?: 'completed' | 'cancelled' | 'unknown'
  note?: string
}

export const ARCHIVE_ARTICLES: ArchiveArticle[] = [
  {
    "id": 141404,
    "year": 2025,
    "publishedAt": "2025-07-19",
    "source": "GSPN",
    "title": "’02/’04 CAPTURES 4TH FD ALUMNI CROWN",
    "url": "https://www.guamsportsnetwork.com/2025/02-04-captures-4th-fd-alumni-crown/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2025/07/WhatsApp-Image-2025-07-19-at-9.33.15-AM-scaled.jpeg",
    "excerpt": "Big win over 2013 to close out Brotherhood tournament"
  },
  {
    "id": 141388,
    "year": 2025,
    "publishedAt": "2025-07-16",
    "source": "GSPN",
    "title": "FD ALUMNI TOURNEY COMING TO A CLOSE",
    "url": "https://www.guamsportsnetwork.com/2025/fd-alumni-tourney-coming-to-a-close/",
    "imageUrl": null,
    "excerpt": "Friday night is championship night"
  },
  {
    "id": 140910,
    "year": 2025,
    "publishedAt": "2025-07-04",
    "source": "GSPN",
    "title": "RESULTS FROM THIS WEEK’S FD ALUMNI HOOPS TOURNEY",
    "url": "https://www.guamsportsnetwork.com/2025/results-from-this-weeks-fd-alumni-hoops-tourney/",
    "imageUrl": null,
    "excerpt": "Monday to Thursday scores"
  },
  {
    "id": 140660,
    "year": 2025,
    "publishedAt": "2025-06-29",
    "source": "GSPN",
    "title": "RECAP OF FD ALUMNI BASKETBALL WEEKEND",
    "url": "https://www.guamsportsnetwork.com/2025/recap-of-fd-alumni-basketball-weekend/",
    "imageUrl": null,
    "excerpt": "Scores from the opening weekend of the Brotherhood Bash"
  },
  {
    "id": 140594,
    "year": 2025,
    "publishedAt": "2025-06-28",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS OPENS WITH A BANG",
    "url": "https://www.guamsportsnetwork.com/2025/fd-alumni-hoops-opens-with-a-bang/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2025/06/WhatsApp-Image-2025-06-27-at-11.15.12-PM-scaled.jpeg",
    "excerpt": "Newest alumni takes opening night stage over defending champs"
  },
  {
    "id": 134079,
    "year": 2024,
    "publishedAt": "2024-07-20",
    "source": "GSPN",
    "title": "SHIMIZU ADDS INSTANT LORE TO FD ALUMNI TRADITION",
    "url": "https://www.guamsportsnetwork.com/2024/shimizu-adds-instant-lore-to-fd-alumni-tradition/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2024/07/DSC0116-Enhanced-NR-scaled.jpg",
    "excerpt": "Buzzer-beater bounces in for ’16/’17 championship"
  },
  {
    "id": 133977,
    "year": 2024,
    "publishedAt": "2024-07-13",
    "source": "GSPN",
    "title": "JUNGLE BOYS TOURNEY PLAYOFF PREDICTIONS",
    "url": "https://www.guamsportsnetwork.com/2024/jungle-boys-tourney-playoff-preview/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2024/06/FD-Alumni-1.jpg",
    "excerpt": "Eddie Pelkey breaks down the playoff picture for the 2024 FD alumni tourney"
  },
  {
    "id": 133934,
    "year": 2024,
    "publishedAt": "2024-07-08",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS HITS HALFWAY POINT",
    "url": "https://www.guamsportsnetwork.com/2024/fd-alumni-hoops-hits-halfway-point/",
    "imageUrl": null,
    "excerpt": "Brotherhood gathering marches toward the playoffs"
  },
  {
    "id": 133771,
    "year": 2024,
    "publishedAt": "2024-06-27",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS: IT’S THAT TIME AGAIN!",
    "url": "https://www.guamsportsnetwork.com/2024/fd-alumni-hoops-its-that-time-again/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2024/06/FD-Alumni-1.jpg",
    "excerpt": "Annual brotherhood bash ready to tip off"
  },
  {
    "id": 126042,
    "year": 2023,
    "publishedAt": "2023-07-22",
    "source": "GSPN",
    "title": "CLASS OF 2013 KINGS OF FRIARFEST",
    "url": "https://www.guamsportsnetwork.com/2023/class-of-2013-kings-of-friarfest/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2023/07/COVER-PHOTO-1-scaled.jpg",
    "excerpt": "Sakazaki leads host class to 2nd title"
  },
  {
    "id": 126016,
    "year": 2023,
    "publishedAt": "2023-07-17",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS PLAYOFF RECAP",
    "url": "https://www.guamsportsnetwork.com/2023/fd-alumni-hoops-playoff-recap/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2023/06/brothers-ig.jpg",
    "excerpt": "Weekend results"
  },
  {
    "id": 125827,
    "year": 2023,
    "publishedAt": "2023-07-08",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS HITS THE HALFWAY MARK",
    "url": "https://www.guamsportsnetwork.com/2023/fd-alumni-hoops-hits-the-halfway-mark/",
    "imageUrl": null,
    "excerpt": "Friarfest heads to final weekend before playoffs begin"
  },
  {
    "id": 125667,
    "year": 2023,
    "publishedAt": "2023-07-03",
    "source": "GSPN",
    "title": "SUNDAY RECAP OF FD ALUMNI HOOPS",
    "url": "https://www.guamsportsnetwork.com/2023/sunday-recap-of-fd-alumni-hoops/",
    "imageUrl": null,
    "excerpt": "Friarfest in full swing"
  },
  {
    "id": 125646,
    "year": 2023,
    "publishedAt": "2023-06-30",
    "source": "GSPN",
    "title": "OPENING NIGHT OF 2023 FD BASKETBALL TOURNAMENT",
    "url": "https://www.guamsportsnetwork.com/2023/opening-night-of-2023-fd-basketball-tournament/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2023/06/The-class-of-2016_17-huddle-together-after-a-huge-opening-night-game.-photo-by-Cam-Santos.jpg",
    "excerpt": "FD Brotherhood get annual tournament started"
  },
  {
    "id": 125618,
    "year": 2023,
    "publishedAt": "2023-06-27",
    "source": "GSPN",
    "title": "ANNUAL FRIARFEST HOOPS TOURNEY ON TAP",
    "url": "https://www.guamsportsnetwork.com/2023/annual-friarfest-hoops-tourney-on-tap/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2023/06/brothers-ig.jpg",
    "excerpt": "Preview of the top teams heading into the 2023 version of the FD Alumni Tournament"
  },
  {
    "id": 115738,
    "year": 2022,
    "publishedAt": "2022-07-15",
    "source": "GSPN",
    "title": "’02/’04 RECLAIMS FD ALUMNI HOOPS REIGN",
    "url": "https://www.guamsportsnetwork.com/2022/02-04-reclaims-fd-alumni-hoops-reign/",
    "imageUrl": null,
    "excerpt": "Perez leads the way with 25 points"
  },
  {
    "id": 115692,
    "year": 2022,
    "publishedAt": "2022-07-14",
    "source": "GSPN",
    "title": "2020 BLOWS OUT ’06 IN FD SEMIFINALS",
    "url": "https://www.guamsportsnetwork.com/2022/2020-blows-out-06-in-fd-semifinals/",
    "imageUrl": null,
    "excerpt": "Championship night this Friday"
  },
  {
    "id": 115604,
    "year": 2022,
    "publishedAt": "2022-07-12",
    "source": "GSPN",
    "title": "PLAYOFF WEEK FOR FRIARS BASKETBALL",
    "url": "https://www.guamsportsnetwork.com/2022/playoff-week-for-friars-basketball/",
    "imageUrl": null,
    "excerpt": "2020 eliminates host 12 Pack"
  },
  {
    "id": 115437,
    "year": 2022,
    "publishedAt": "2022-07-05",
    "source": "GSPN",
    "title": "FD ALUMNI BASKETBALL PLAYOFFS ALL SET",
    "url": "https://www.guamsportsnetwork.com/2022/fd-alumni-basketball-playoffs-all-set/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FDMS-logo.png",
    "excerpt": "Elitists tournament enters single-elimination playoffs"
  },
  {
    "id": 115320,
    "year": 2022,
    "publishedAt": "2022-07-03",
    "source": "GSPN",
    "title": "’05 SHOCKS ’06 AS FD TOURNEY ROLLS ALONG",
    "url": "https://www.guamsportsnetwork.com/2022/05-shocks-06-as-fd-tourney-rolls-along/",
    "imageUrl": null,
    "excerpt": "2006 drops two games in one week!"
  },
  {
    "id": 115245,
    "year": 2022,
    "publishedAt": "2022-06-30",
    "source": "GSPN",
    "title": "8-TIME FD CHAMPS TAKEN DOWN",
    "url": "https://www.guamsportsnetwork.com/2022/8-time-fd-champs-taken-down/",
    "imageUrl": null,
    "excerpt": "Rematch of 2021 title game"
  },
  {
    "id": 115156,
    "year": 2022,
    "publishedAt": "2022-06-27",
    "source": "GSPN",
    "title": "FD ALMUNI HOOPS TOURNEY IN FULL SWING",
    "url": "https://www.guamsportsnetwork.com/2022/fd-almuni-hoops-tourney-in-full-swing/",
    "imageUrl": null,
    "excerpt": "Annual brotherhood basketball festival underway"
  },
  {
    "id": 107042,
    "year": 2021,
    "publishedAt": "2021-07-30",
    "source": "GSPN",
    "title": "2006 BRINGS IN EIGHTH ALUMNI TITLE IN BIG WAY",
    "url": "https://www.guamsportsnetwork.com/2021/2006-brings-in-eighth-alumni-title-in-big-way/",
    "imageUrl": null,
    "excerpt": "The Class of 2006 captures their 8th FD Alumni Tournament title to close out the 2021 summer."
  },
  {
    "id": 106886,
    "year": 2021,
    "publishedAt": "2021-07-16",
    "source": "GSPN",
    "title": "FRIDAY NIGHT FD ALUMNI HOOPS",
    "url": "https://www.guamsportsnetwork.com/2021/friday-night-fd-alumni-hoops/",
    "imageUrl": null,
    "excerpt": "The 2021 FD Alumni Basketball Tournament is approaching the end of pool play this weekend with Monday marking the last of make-up games before the playoffs. The combined Class of 04/02 held off a comeback from the most decorated Champions of the Alumni Tourney in ’06 with Sean Perez hitting a pair of clutch buckets […]"
  },
  {
    "id": 106747,
    "year": 2021,
    "publishedAt": "2021-07-09",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS BACK IN ACTION",
    "url": "https://www.guamsportsnetwork.com/2021/fd-alumni-hoops-back-from-year-off/",
    "imageUrl": null,
    "excerpt": "After the COVID-19 Pandemic forced the FD Alumni Basketball Tournament to close it’s doors in 2020, Friday evening marked the return of the highly anticipated summer tourney for it’s return in 2021. Three rivalry games opened the evening at the FD Jungle to start the three-week long tourney. ’79/’80 – 38, ’75 – 15The sharpshooting […]"
  },
  {
    "id": 93255,
    "year": 2019,
    "publishedAt": "2019-07-12",
    "source": "GSPN",
    "title": "2006 CAPTURES SEVENTH FD ALUMNI TITLE",
    "url": "https://www.guamsportsnetwork.com/2019/2006-captures-seventh-fd-alumni-title/",
    "imageUrl": null,
    "excerpt": "The Class of 2006 have added yet another basketball title to their seemingly ever-growing collection as they defeated the Class of 2009, the tournament’s host, 49-46 at The Jungle Friday evening in the Maroon Division."
  },
  {
    "id": 93021,
    "year": 2019,
    "publishedAt": "2019-07-08",
    "source": "GSPN",
    "title": "WEEKEND ROUND-UP OF ALUMNI TOURNAMENT PLAYOFFS",
    "url": "https://www.guamsportsnetwork.com/2019/weekend-round-alumni-tournament-playoffs/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2019/07/IMG-6076.jpg",
    "excerpt": "The first round of the playoffs in the FD Alumni summer basketball tournament continued this Saturday and with the quarterfinals happening Sunday."
  },
  {
    "id": 92309,
    "year": 2019,
    "publishedAt": "2019-06-21",
    "source": "GSPN",
    "title": "2006 BEATS 2016 AS ALUMNI TOURNEY TIPS OFF",
    "url": "https://www.guamsportsnetwork.com/2019/2006-beats-2016-alumni-tourney-tips-off/",
    "imageUrl": null,
    "excerpt": "No event quite fills the FD Jungle like opening night in FD Alumni Basketball Tournament."
  },
  {
    "id": 78795,
    "year": 2018,
    "publishedAt": "2018-07-13",
    "source": "GSPN",
    "title": "2002/04 REPEAT AS FD ALUMNI CHAMPIONS",
    "url": "https://www.guamsportsnetwork.com/2018/live-video-fd-alumni-tournament-finals/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-13.jpg",
    "excerpt": "Repeat Champions!"
  },
  {
    "id": 78653,
    "year": 2018,
    "publishedAt": "2018-07-09",
    "source": "GSPN",
    "title": "430-5, 06 PICK UP WEEKEND PLAYOFF WINS IN FD TOURNEY",
    "url": "https://www.guamsportsnetwork.com/2018/430-5-06-pick-weekend-playoff-wins-fd-tourney/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/IMG_2771.jpg",
    "excerpt": "Playoff action picked up Sunday afternoon in the FD Alumni Basketball Tournament. Class 430-5 knocked off the oldest class of 75 while 06 and the host class 2008 picked up wins."
  },
  {
    "id": 78398,
    "year": 2018,
    "publishedAt": "2018-06-30",
    "source": "GSPN",
    "title": "UPPER CLASSES TAKE FD ALUMNI TOURNEY WINS",
    "url": "https://www.guamsportsnetwork.com/2018/upper-classes-take-fd-alumni-tourney-wins/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2018/06/2018-FD-Alumni-Tournament-02.jpg",
    "excerpt": "The upper classes had the upper hand Saturday in the morning games as the vets dished out some lessons for the FD Alumni Tournament’s youngest teams."
  },
  {
    "id": 78263,
    "year": 2018,
    "publishedAt": "2018-06-25",
    "source": "GSPN",
    "title": "FD ALUMNI SUNDAY SCORES",
    "url": "https://www.guamsportsnetwork.com/2018/fd-alumni-sunday-scores/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2018/06/20180624_200020.jpg",
    "excerpt": "The FD Alumni Tournament wrapped up opening their weekend with seven more games on Sunday. Pool play continues throughout the week with the playoffs set to begin on July 6th!"
  },
  {
    "id": 69033,
    "year": 2017,
    "publishedAt": "2017-07-15",
    "source": "GSPN",
    "title": "ESTELLA HITS GAME WINNER TO GIVE 02/04 FD ALUMNI TITLE",
    "url": "https://www.guamsportsnetwork.com/2017/estella-hits-game-winner-give-0204-fd-alumni-title/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2017/07/IMG_6539.jpg",
    "excerpt": "It was built as the ‘Super Team’ vs ‘The Dynasty’. The combined Class of 02/04 had to go through the second most winningest Alumni Tourney Class of 2006 in one epic showdown to conclude the 2017 FD Alumni Basketball Tournament Friday night."
  },
  {
    "id": 68813,
    "year": 2017,
    "publishedAt": "2017-07-09",
    "source": "GSPN",
    "title": "TEAMS MAKE EXITS IN SUNDAY’S FD ALUMNI PLAYOFFS",
    "url": "https://www.guamsportsnetwork.com/2017/teams-make-exits-sundays-fd-alumni-playoffs/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2017/06/logo-3.png",
    "excerpt": "The annual FD Alumni Basketball Tournament is rendering it’s single-elimination playoffs, separating the title contenders from the pretenders. Sunday’s action involved a handful of lopsided games with the usual suspects moving on to the final week of play. Scores 2006 – 53, 91 – 32 Steve Sablan and AJ Reyes scored 13 each as the […]"
  },
  {
    "id": 68662,
    "year": 2017,
    "publishedAt": "2017-06-28",
    "source": "GSPN",
    "title": "PAULINO SINKS GAME WINNER FOR RIVAL WIN OVER 2013",
    "url": "https://www.guamsportsnetwork.com/2017/paulino-sinks-game-winner-rival-win-2013/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2017/06/IMG_3301.jpg",
    "excerpt": "Late-game heroics in FD Alumni hoops."
  },
  {
    "id": 68649,
    "year": 2017,
    "publishedAt": "2017-06-28",
    "source": "GSPN",
    "title": "FD ALUMNI BASKETBALL: TUESDAY SCORES",
    "url": "https://www.guamsportsnetwork.com/2017/fd-alumni-basketball-tuesday-scores/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2017/06/logo-3.png",
    "excerpt": "Get the latest scores from Tuesday nights FD Alumni Basketball Tourney."
  },
  {
    "id": 68582,
    "year": 2017,
    "publishedAt": "2017-06-24",
    "source": "GSPN",
    "title": "FD ALUMNI BASKETBALL TIP-OFF WEEKEND",
    "url": "https://www.guamsportsnetwork.com/2017/fd-alumni-basketball-tip-off-weekend/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2017/06/IMG_3238.jpg",
    "excerpt": "The 2017 FD Alumni Tournament, hosted by the class of 2007, has officially tipped off!"
  },
  {
    "id": 64918,
    "year": 2017,
    "publishedAt": "2017-01-31",
    "source": "GSPN",
    "title": "FRIARS RETIRE SIX BASKETBALL JERESEYS",
    "url": "https://www.guamsportsnetwork.com/2017/friars-retire-six-basketball-jereseys/",
    "imageUrl": null,
    "excerpt": "Six jerseys numbers will be worn in FD Basketball history ever again. This past Sunday, the FD Friar Alumni Association hosted its first ever retirement ceremony at the Phoenix Center for the likes of six legendary ballers who suited up in maroon and gold. Retired Jerseys Ricardo Eusebio #33 (1972) Eduardo ‘Champ’ Calvo #10 (1974) […]"
  },
  {
    "id": 56906,
    "year": 2015,
    "publishedAt": "2015-06-29",
    "source": "GSPN",
    "title": "2015 FD ALUMNI TOURNEY: VIDEO RECAP",
    "url": "https://www.guamsportsnetwork.com/2015/2015-fd-alumni-tourney-video-recap/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/Screen-Shot-2015-06-29-at-6.19.49-PM.png",
    "excerpt": "The men of Father Duenas once again put together a memorable summer event in the 2015 FD Alumni Basketball Tournament with the Class of 2013 claiming their first ever title in just their third run in the tourney. Led by John Baza and Guam’s National Basketball player Mike Sakazaki, the Class of ’13 overcame a […]"
  },
  {
    "id": 56809,
    "year": 2015,
    "publishedAt": "2015-06-27",
    "source": "GSPN",
    "title": "2013 WINS FIRST EVER FD ALUMNI TOURNEY",
    "url": "https://www.guamsportsnetwork.com/2015/2013-wins-first-ever-fd-alumni-tourney/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-10.jpg",
    "excerpt": "The Class of 2013 earned a lot more than just respect Friday night, they won the FD Alumni Basketball title over the defending champion’s in Class of 2004 at the packed FD Jungle behind a big showing from guard John Baza."
  },
  {
    "id": 56761,
    "year": 2015,
    "publishedAt": "2015-06-25",
    "source": "GSPN",
    "title": "2004 TO FACE 2013 IN FD HOOPS FINALS",
    "url": "https://www.guamsportsnetwork.com/2015/2004-to-face-2013-in-fd-hoops-finals/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/Alumni-41.jpg",
    "excerpt": "The Class of 2004 will get a chance to defend their FD Alumni Basketball title after defeating the Class of 2008 in the semis. They will meet the Class of 2013, who had to get through a gritty bunch of five-time Alumni champs in 2006."
  },
  {
    "id": 56687,
    "year": 2015,
    "publishedAt": "2015-06-24",
    "source": "GSPN",
    "title": "FINAL FOUR SET IN FD HOOPS",
    "url": "https://www.guamsportsnetwork.com/2015/final-four-set-in-fd-hoops/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/BBall-112.jpg",
    "excerpt": "The Class of 2013 and 2010 put on an awesome display of FD Alumni Basketball in the best game of the tournament with 2013 claiming victors. 2006 defeated 1999 to make it to the semifinals Wednesday night to play 2013 while 2004 will play the Class of 2008."
  },
  {
    "id": 56658,
    "year": 2015,
    "publishedAt": "2015-06-21",
    "source": "GSPN",
    "title": "FATHER’S DAY BUCKETS IN ALUMNI PLAYOFFS",
    "url": "https://www.guamsportsnetwork.com/2015/fathers-day-buckets-in-alumni-playoffs/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/IMG_0093.jpg",
    "excerpt": "The FD Alumni Basketball Tournament continued on Father’s Day with several single elimination playoff games at played at the “Jungle”. Teams are moving on and classes are getting knocked off, but see who’s still in the run as the tourney is set to wrap up Friday evening."
  },
  {
    "id": 56590,
    "year": 2015,
    "publishedAt": "2015-06-21",
    "source": "GSPN",
    "title": "THE EUSEBIOS: ALUMNI BASKETBALL",
    "url": "https://www.guamsportsnetwork.com/2015/the-eusebios-alumni-basketball/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/IMG_2544.jpg",
    "excerpt": "Dr. Andrew Eusebio and his three sons have a lot of things in common. All are members of the Father Duenas family and all of them have suited up for the Friars basketball squad. Get to know the men and how basketball, being an FD Friar, and family bind them together on this Father’s Day special!"
  },
  {
    "id": 56536,
    "year": 2015,
    "publishedAt": "2015-06-19",
    "source": "GSPN",
    "title": "PLAYOFF ACTION UNDERWAY FOR FD HOOPS",
    "url": "https://www.guamsportsnetwork.com/2015/playoff-action-underway-for-fd-hoops/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/BBall-13.jpg",
    "excerpt": "Playoffs have just started in the FD Alumni tournament and things are already heating up with classes bringing in the competitiveness showing how much they want to win. Tuesday night’s game came with two close games that brought the people in the Jungle in the edge of their seats."
  },
  {
    "id": 56178,
    "year": 2015,
    "publishedAt": "2015-06-14",
    "source": "GSPN",
    "title": "FD ALUMNI BASKETBALL TOURNEY SCOREBOARD",
    "url": "https://www.guamsportsnetwork.com/2015/fd-alumni-basketball-tourney-scoreboard/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/website-logo-copy.jpg",
    "excerpt": "Get all the scores from every game all FD Friars Alumni tourney long here with Guam Sports Network!"
  },
  {
    "id": 56409,
    "year": 2015,
    "publishedAt": "2015-06-13",
    "source": "GSPN",
    "title": "ONE WEEK DONE IN FD ALUMNI HOOPS",
    "url": "https://www.guamsportsnetwork.com/2015/one-week-done-in-alumni-hoops/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/IMG_0086.jpg",
    "excerpt": "The FD Alumni Tournament wrapped up one week of play Friday with the playoffs soon to follow. Pool play is heating up at the jungle!"
  },
  {
    "id": 45029,
    "year": 2014,
    "publishedAt": "2014-07-21",
    "source": "GSPN",
    "title": "BROTHERHOOD EXEMPLIFIED AMONG ALUMNI",
    "url": "https://www.guamsportsnetwork.com/2014/brotherhood-exemplified-among-fd-alumni/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/FD-logo1.jpg",
    "excerpt": "Exciting games and lots of food. Another year in the books for the traditional Father Duenas Alumni Basketball Tournament."
  },
  {
    "id": 44948,
    "year": 2014,
    "publishedAt": "2014-07-19",
    "source": "GSPN",
    "title": "2004 WINS COVETED FD ALUMNI TITLE",
    "url": "https://www.guamsportsnetwork.com/2014/2004-wins-coveted-fd-alumni-title/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_2409.jpg",
    "excerpt": "Since joining the FD Alumni Tournament 10 years ago, the men of 2004 capped off a memorable year by not only hosting the tourney, but also beating the Class of 2012 in the finals to capture their first Alumni title."
  },
  {
    "id": 44870,
    "year": 2014,
    "publishedAt": "2014-07-18",
    "source": "GSPN",
    "title": "2004 TO PLAY 2012 IN ALUMNI FINALS",
    "url": "https://www.guamsportsnetwork.com/2014/2004-to-play-2012-in-alumni-finals/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_1968.jpg",
    "excerpt": "Then there were two. The host Class of 2004 and upstart Class of 2012 will lay it all on the line Friday night in this summers finale of the FD Alumni Tournament after getting big wins in the semifinals Thursday night."
  },
  {
    "id": 44834,
    "year": 2014,
    "publishedAt": "2014-07-17",
    "source": "GSPN",
    "title": "79/80 OLDIES MOVE ON TO FD SEMIFINALS",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-tourney-heading-into-semis/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_1816.jpg",
    "excerpt": "Although the 2014 FD Alumni Basketball Tournament nears its end, the excitement and unexpected upsets seem to get better and better as the final days approach. In the quarterfinal games on Wednesday night, a pair of upsets took place with last minute clutch shots and shocking come from behind wins."
  },
  {
    "id": 44793,
    "year": 2014,
    "publishedAt": "2014-07-16",
    "source": "GSPN",
    "title": "2006 DENIED SIXTH TITLE BY 2013",
    "url": "https://www.guamsportsnetwork.com/2014/2006-denied-sixth-title-by-2013/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/04/GSPN-Homepage.jpg",
    "excerpt": "Class of 2013 just accomplished something no team has been able to do for the past five years which is knock the Class of 2006 out of the playoffs, more importantly denying them a chance at repeating as FD Alumni Tournament champs for the sixth straight year."
  },
  {
    "id": 44752,
    "year": 2014,
    "publishedAt": "2014-07-15",
    "source": "GSPN",
    "title": "ALUMNI TOURNEY PLAYOFFS HEATING UP",
    "url": "https://www.guamsportsnetwork.com/2014/alumni-tourney-playoffs-heating-up/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_5501.jpg",
    "excerpt": "The Class of 2012 proved Monday night that they’re a legitimate threat to take the 2014 FD Alumni Basketball title after narrowly defeating the tough Class of 2010 in a thrilling down to the wire game while 1991/98 managed to hold off the Class of 2007’s late rally."
  },
  {
    "id": 44725,
    "year": 2014,
    "publishedAt": "2014-07-14",
    "source": "GSPN",
    "title": "BUZZER BEATER SENDS 02/03 PACKING",
    "url": "https://www.guamsportsnetwork.com/2014/buzzer-beater-sends-0203-packing/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_5106.jpg",
    "excerpt": "Classes started falling during the second day of the single elimination playoffs in the annual FD Alumni Basketball Tournament with the night ending in dramatic fashion as 2009 knocked off the power house class of 2002/03 with a last second shot."
  },
  {
    "id": 44690,
    "year": 2014,
    "publishedAt": "2014-07-13",
    "source": "GSPN",
    "title": "FD ALUMNI ENTERS PLAYOFF STRETCH",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-enters-playoff-stretch/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4999.jpg",
    "excerpt": "The FD Alumni Tournament featured two playoff games Saturday night, as well as the final day of pool play, as the Class of 2008 and 2000/01 got first round wins to stay alive for the weekend."
  },
  {
    "id": 44681,
    "year": 2014,
    "publishedAt": "2014-07-12",
    "source": "GSPN",
    "title": "STORM CAN’T STOP FD ALUMNI TOURNEY",
    "url": "https://www.guamsportsnetwork.com/2014/storm-cant-stop-fd-alumni-tourney/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4964.jpg",
    "excerpt": "Not even the possibility of a tropical storm could keep the FD Alumni Tournament from rolling on Friday night featuring three games, but an even bigger crowd."
  },
  {
    "id": 44462,
    "year": 2014,
    "publishedAt": "2014-07-07",
    "source": "GSPN",
    "title": "FD ALUMNI: STINNETT DROPS 38 ON 2010",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-stinnett-drops-38-on-2010/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4885.jpg",
    "excerpt": "William Stinnett had a monstrous night scoring 38 points, while getting a late heroic performance from Chris Santos and Napoleon Finch, to give the FD Alumni Tournament host class of 2004 a big win over the Class of 2010 Monday night."
  },
  {
    "id": 44378,
    "year": 2014,
    "publishedAt": "2014-07-06",
    "source": "GSPN",
    "title": "FD ALUMNI: 2006 RECOVERS FROM FIRST LOSS",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-2006-recovers-from-first-loss/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4843.jpg",
    "excerpt": "The FD Jungle continued to have its court rocking as the annual Alumni Tournament finished its third day of action all day Saturday."
  },
  {
    "id": 44341,
    "year": 2014,
    "publishedAt": "2014-07-05",
    "source": "GSPN",
    "title": "FD ALUMNI TOURNAMENT DAY 2",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-tournament-day-2/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_0293.jpg",
    "excerpt": "The FD Alumni Tournament rolled through the July 4th National Holiday with a slew of games, including a couple of close matches between rival classes."
  },
  {
    "id": 44354,
    "year": 2014,
    "publishedAt": "2014-07-03",
    "source": "GSPN",
    "title": "FD ALUMNI TOURNAMENT SCOREBOARD",
    "url": "https://www.guamsportsnetwork.com/2014/fd-alumni-basketball-tournament-scoreboard/",
    "imageUrl": "https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4843.jpg",
    "excerpt": "Day 1 1996/97 – 46, 1999 – 44 (shootout) 2003 – 56, 2006 – 46 1981/82 – 46, 1988 – 36 Day 2 2007 – 43, 2008 – 37 1995 – 63, 2000/01 – 57 2010 – 62, 2014 – 53 1979 – 48, 1975 – 23 1970/75 – 21, 1960 – 16 1991/98 – […]"
  },
  {
    "id": 30318,
    "year": 2013,
    "publishedAt": "2013-07-23",
    "source": "GSPN",
    "title": "FD ’06 ON TETRAVALENT STREAK",
    "url": "https://www.guamsportsnetwork.com/2013/fd-06-on-tetravalent-streak/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Patrick Lujan The Class of 2006 is in the midst of building a basketball dynasty. Just seven years removed from graduating from Father Duenas, 06 captured their fifth FD Alumni Basketball Tournament championship Tuesday night with a 63-49 win over 2004 in the title game. It is their fourth championship in a row […]"
  },
  {
    "id": 30112,
    "year": 2013,
    "publishedAt": "2013-07-20",
    "source": "GSPN",
    "title": "2006 KNOCKS OUT 2010",
    "url": "https://www.guamsportsnetwork.com/2013/2006-knocks-out-2010/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia Two of the most entertaining teams to watch all tournament faced off once more in the FD Alumni Tournament with 2006 keeping their title defend hopes alive by taking out the young guns of 2010, 60-54. Julius Yu led ’06 in scoring with 11 points but key offensive rebounds from teammate […]"
  },
  {
    "id": 30096,
    "year": 2013,
    "publishedAt": "2013-07-20",
    "source": "GSPN",
    "title": "TOURNEY FRESHMEN MOVING ON",
    "url": "https://www.guamsportsnetwork.com/2013/tourney-freshman-moving-on/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Colin Leon Guerrero The Class of 2013 pulled off an impressive playoff victory, defeating Class of 2009 48-44 Friday night in the FD Alumni Basketball Tournament at the Jungle. ’13 came out very aggressive as John Baza, Jon Onedera, and Anthony Olchondra used their fresh legs to cut between defenders and get to […]"
  },
  {
    "id": 30052,
    "year": 2013,
    "publishedAt": "2013-07-17",
    "source": "GSPN",
    "title": "FD ALUMNI MASTERS ROUND",
    "url": "https://www.guamsportsnetwork.com/2013/fd-alumni-masters-round/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia 1991 – 71, 1970 – 52 Chief Justice Robert Torres led the eldest class in the tournament with 24 points but the Class of ’91 hit 12 three pointers which helped them advance to the quarter finals in the FD Alumni Tournament. The Class of ’70 were also playing with the […]"
  },
  {
    "id": 30011,
    "year": 2013,
    "publishedAt": "2013-07-16",
    "source": "GSPN",
    "title": "MARTINEZ SINKS GAME WINNER",
    "url": "https://www.guamsportsnetwork.com/2013/martinez-sinks-game-winner/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] Robert Balajadia 2007 – 53, 2000/05 – 51 The fate of 2007’s FD Alumni Basketball Tournament lives came down to two plays, on offense and defense, where ’07’s Jude Martinez and Brandon Duenas delivered while overcoming 2000/’05’s Nick Santos’ 27 points. With the game tied at 51, Martinez looked at the clock and noticed […]"
  },
  {
    "id": 29984,
    "year": 2013,
    "publishedAt": "2013-07-15",
    "source": "GSPN",
    "title": "FD PLAYOFF ACTION UNDERWAY",
    "url": "https://www.guamsportsnetwork.com/2013/fd-playoff-action-underway/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Colin Leon Guerrero “It was like playing our little brothers tonight, so we have to treat them like little brothers,” said Earvin Jose after his Class of 2010 defeated the Class of 2012 46-43 in a tense playoff game at the FD Alumni Basketball Tournament Monday night at The Jungle. Knowing that the […]"
  },
  {
    "id": 29487,
    "year": 2013,
    "publishedAt": "2013-07-14",
    "source": "GSPN",
    "title": "’06 TO START TITLE DEFENSE",
    "url": "https://www.guamsportsnetwork.com/2013/06-to-start-title-defense/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia 2006 – 72, 2007 – 61 The Class of 2006 finished pool play in the FD Alumni Tournament undefeated as they got past a hot start from 2007. Julius Yu led ’06 with 18 points while Jude Martinez finished with 24 points and teammate Brandon Duenas had 20. ’07 managed to […]"
  },
  {
    "id": 29468,
    "year": 2013,
    "publishedAt": "2013-07-13",
    "source": "GSPN",
    "title": "FD ALUMNI FRIDAY NIGHT",
    "url": "https://www.guamsportsnetwork.com/2013/fd-alumni-friday-night/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Colin Leon Guerrero In Day 8 of the FD Alumni Basketball Tournament, Class of 1999 showed that they are still in their prime after defeating the combined team of 2000 and 2005, 53-35 Friday night at the Jungle. 99’s Johnny Holbrom got things going for his class scoring the first five buckets within […]"
  },
  {
    "id": 29378,
    "year": 2013,
    "publishedAt": "2013-07-11",
    "source": "GSPN",
    "title": "UNBEATEN STREAKS CONTINUE",
    "url": "https://www.guamsportsnetwork.com/2013/unbeaten-streaks-continue/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia 1996/97 – 61, 1995 – 49 Longtime FD Friar basketball head coach Eddie Pelkey dropped 19 points for Class of ’96/97 to move his team past their rivals of 1995 on Day 6 of the FD Alumni Basketball Tournament. Chris Ogo had a big game for ’96/97 as well finishing with […]"
  },
  {
    "id": 29192,
    "year": 2013,
    "publishedAt": "2013-07-07",
    "source": "GSPN",
    "title": "FD ALUMNI BASKETBALL SCOREBOARD",
    "url": "https://www.guamsportsnetwork.com/2013/fd-alumni-basketball-scoreboard/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] PLAYOFFS: Day 6 2006 – 60, 2010 – 54 2006 – 70, 2002 – 56 1999 – 51, 1991 – 29 2004 – 51, 430 – 29 PLAYOFFS: Day 5 2013 – 48, 2009 – 44 PLAYOFFS: Day 4 2001 – 43, 2008 – 40 2002 – 65, 2011 – 41 430 def. 2007 […]"
  },
  {
    "id": 29146,
    "year": 2013,
    "publishedAt": "2013-07-06",
    "source": "GSPN",
    "title": "FD TOURNEY OPENING WEEKEND",
    "url": "https://www.guamsportsnetwork.com/2013/fd-tourney-opening-weekend/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia 2000/2005 – 46, 1976/2001 – 39 Neil Espino finished with 12 points to lead the class combination of 2000 and 2005 over the other combined class of 1976 and 2001 with a final score of 46-39 on day two of the FD Alumni Tournament. Frank Perez of ’76/’01 led all scorers […]"
  },
  {
    "id": 29097,
    "year": 2013,
    "publishedAt": "2013-07-05",
    "source": "GSPN",
    "title": "THE FD ALUMNI REIGN OF ’06",
    "url": "https://www.guamsportsnetwork.com/2013/the-fd-alumni-reign-of-06/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia The last time the Father Duenas Friars won a IIAAG Basketball championship was back in 2006. That same class has ruled the FD Alumni Basketball tournament for the past few years winning two back-to-back titles since coming out of high school and are now in contention for their fifth. The four […]"
  },
  {
    "id": 13800,
    "year": 2012,
    "publishedAt": "2012-07-22",
    "source": "GSPN",
    "title": "’06 THREE-PEAT CHAMPS",
    "url": "https://www.guamsportsnetwork.com/2012/06-three-peat-champs/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Robert Balajadia For the third straight year, the Father Duenas Friars Class of 2006 was the last team standing as they defeated the Class of 2002 Sunday night 55-52 to conclude the FD Alumni Tournament. ’06 has now won four of their last five championships since joining the tournament as freshmen. The hosting […]"
  },
  {
    "id": 13686,
    "year": 2012,
    "publishedAt": "2012-07-19",
    "source": "GSPN",
    "title": "CLASS OF ’89 OUSTS ’88",
    "url": "https://www.guamsportsnetwork.com/2012/89-ousts-88/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Errol “DynamiX” Alegre Jr. The Class of ’89 remain alive in the single-elimination playoffs of the Father Duenas Alumni Basketball Tournament after defeating Class of ’88, 28-22, at the FD “Jungle” Gym Wednesday night. Both teams executed half court offense for majority of the game, but with a few fast break spurts led […]"
  },
  {
    "id": 13422,
    "year": 2012,
    "publishedAt": "2012-07-12",
    "source": "GSPN",
    "title": "‘96-‘97 TAKE NAIL-BITING WIN",
    "url": "https://www.guamsportsnetwork.com/2012/96-97-take-nail-biting-win/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Errol “DynamiX” Alegre Jr. In a game where every second counted, Jake Leon Guerrero made sure to utilize whatever time he had left to lift his Class of 1996-1997 to a close 68-67 win over Class of 1995 Wednesday night in the FD Alumni Basketball Tournament. With just four seconds remaining on the […]"
  },
  {
    "id": 13399,
    "year": 2012,
    "publishedAt": "2012-07-10",
    "source": "GSPN",
    "title": "FD ALUMNI HOOPS",
    "url": "https://www.guamsportsnetwork.com/2012/fd-alumni-hoops/",
    "imageUrl": null,
    "excerpt": "Monday July 9 Game 1 Class of ’75 def. Class of ’70 27-26 Game 2 Class of ’74/’98 def. ’95 64-53 Tuesday July 10 Game 1 Class of ’84-’82 def. Class of ’88 30-25 Game 2 Class of ’85-’87 def. Class of ’89 33-32 Game 3 Team 430 def. Class of ’92 69-45 […]"
  },
  {
    "id": 13212,
    "year": 2012,
    "publishedAt": "2012-07-06",
    "source": "GSPN",
    "title": "2012 SLIPS PAST ’79-’80",
    "url": "https://www.guamsportsnetwork.com/2012/2012-slips-past-79-and-80/",
    "imageUrl": null,
    "excerpt": "[sixcol_five_last] By Regina Shiroma Class of 2012 slipped by class of ’79 and ‘80, 55-54 with just 22 seconds left in the second half in the opening game of the FD alumni basketball tournament. The older alumni were given a 20 point lead at the start of the game to even the playing field, as […]"
  },
  {
    "id": 13141,
    "year": 2012,
    "publishedAt": "2012-07-06",
    "source": "GSPN",
    "title": "HISTORY OF THE FD ALUMNI TOURNAMENT",
    "url": "https://www.guamsportsnetwork.com/2012/history-of-the-fd-alumni-basketball-tournament/",
    "imageUrl": null,
    "excerpt": "1985…Memorial Day Weekend…10 Teams. What started as a simple idea after missing a high school reunion, the Father Duenas Alumni Association’s (FDAA) annual basketball tournament is ready to gear up for its 27th consecutive year! “I missed my 10-year reunion with my class. They had a nice get together at a beach, took a class […]"
  },
  {
    "year": 2016,
    "publishedAt": "2016-06-19",
    "source": "PostGuam",
    "title": "2009 drops 2016 in FD alumni game",
    "url": "https://www.postguam.com/sports/local/2009-drops-2016-in-fd-alumni-game/article_1100757a-3618-11e6-97fe-971d35d25d69.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/7/0e/70e89cb6-3617-11e6-9cf7-4b3a01bb31dc/57668cc2c055c.image.jpg?crop=1134%2C595%2C0%2C102",
    "excerpt": "The 2016 FD Alumni Basketball Tournament had its soft opening Friday night with the classes of 2016 and 2009 battling it out for the right to play in the tournaments"
  },
  {
    "year": 2015,
    "publishedAt": "2015-06-09",
    "source": "PostGuam",
    "title": "FD alumni holds basketball tournament",
    "url": "https://www.postguam.com/sports/local/fd-alumni-holds-basketball-tournament/article_adaaadbb-076e-5200-9c91-f8ee3652371e.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/custom/image/f433efec-b17a-11eb-bb56-6f9f445e39b2.jpg?resize=600%2C336",
    "excerpt": "(GSPN) – The Father Duenas Memorial School alumni kicked off its basketball tournament over the weekend, providing much excitement to those present at the FD gym known as “The Jungle.”"
  },
  {
    "year": 2015,
    "publishedAt": "2015-06-21",
    "source": "PostGuam",
    "title": "Playoff action underway for FD Alumni Tournament",
    "url": "https://www.postguam.com/sports/local/playoff-action-underway-for-fd-alumni-tournament/article_fda729c7-dca5-5a37-91f3-dd4127386b4e.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/e/9f/e9fd3d89-3084-5a4a-ba64-faa6055c91e6/566b023052baf.image.jpg?crop=250%2C250%2C63%2C0&resize=200%2C200&order=crop%2Cresize",
    "excerpt": "PLAYOFFS have just started in the FD Alumni Tournament and things are already heating up with classes bringing in the competitiveness showing how much they want to win."
  },
  {
    "year": 2015,
    "publishedAt": "2015-06-15",
    "source": "PostGuam",
    "title": "One week done in FD alumni hoops",
    "url": "https://www.postguam.com/sports/local/one-week-done-in-fd-alumni-hoops/article_e43a2a44-005d-5361-89c4-16b3566e1bfc.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/c/9d/c9d24c56-cab8-580c-8b48-a727e3a33aab/566b01b8eba64.image.jpg?resize=200%2C200",
    "excerpt": "FRIDAY, June 12 represented the one week mark for the 2015 Father Duenas Alumni Tournament and this past week was only the start of barbecue, brotherhood, and basketball."
  },
  {
    "year": 2015,
    "publishedAt": "2015-06-28",
    "source": "PostGuam",
    "title": "Class of 2013 wins first FD Alumni Basketball tourney",
    "url": "https://www.postguam.com/sports/local/class-of-2013-wins-first-fd-alumni-basketball-tourney/article_8a8f0516-605b-57a7-9855-a28b287c8570.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/9/f7/9f7a3457-736d-526b-9e5d-7dc37f355768/566b01920b57e.image.jpg?crop=250%2C250%2C63%2C0&resize=200%2C200&order=crop%2Cresize",
    "excerpt": "THE 30th annual Father Duenas Alumni Basketball has come to a close and a packed FD gym known as the “jungle” witnessed a competitive game featuring the defending champion class"
  },
  {
    "year": 2022,
    "publishedAt": "2022-07-16",
    "source": "PostGuam",
    "title": "Estella, Perez, Stinnett lead 02/04 to 5th FD Alumni basketball title",
    "url": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/a/59/a59021e4-0485-11ed-bdfc-6f8007f30b71/62d1dcf54eeb1.image.png?crop=1053%2C553%2C0%2C106",
    "excerpt": "Despite a career night form Christian Leon Guerrero, where the class-of-2020 sharpshooter drained an unprecedented six three-pointers in the first half, the class of 2002/2004 claimed their fifth Father Duenas"
  },
  {
    "year": 2025,
    "publishedAt": "2025-07-15",
    "source": "PostGuam",
    "title": "FDMS alumni return to the jungle for hoops, memories, and giving back",
    "url": "https://www.postguam.com/forum/letter_to_the_editor/fdms-alumni-return-to-the-jungle-for-hoops-memories-and-giving-back/article_f1cdf2e6-e095-4ffb-ac30-c1d07d3b15d9.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/d/5c/d5c009bc-410c-4c39-aca0-812023ec494a/686d099a56c60.image.jpg?crop=1763%2C926%2C0%2C124&resize=1200%2C630&order=crop%2Cresize",
    "excerpt": "Summer is here and on Guam that means BBQs, basketball and reconnecting with old friends. Over the last few weeks, alumni from the island’s only private boys' school made their"
  },
  {
    "year": 2014,
    "publishedAt": "2014-07-18",
    "source": "PostGuam",
    "title": "Class of '65 scores upset in Father Duenas tournament",
    "url": "https://www.postguam.com/sports/local/class-of-65-scores-upset-in-father-duenas-tournament/article_9eed1e68-3acd-54f5-b5bb-ec8ed0af6c55.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/d/fe/dfe271b2-9192-5f40-bde5-0fdbf52837c2/566b006750bd0.image.jpg?crop=250%2C250%2C63%2C0&resize=200%2C200&order=crop%2Cresize",
    "excerpt": "FATHER Duenas Alumni basketball teams battled their way through the FD Tournament single game elimination playoffs that began on Sunday."
  },
  {
    "year": 2014,
    "publishedAt": "2014-07-21",
    "source": "PostGuam",
    "title": "Class of 1974 wins Father Duenas milestone basketball game",
    "url": "https://www.postguam.com/sports/local/class-of-1974-wins-father-duenas-milestone-basketball-game/article_5064f09e-150d-5370-a554-f664c43c3c7d.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/custom/image/f433efec-b17a-11eb-bb56-6f9f445e39b2.jpg?resize=600%2C336",
    "excerpt": "WITH the score tied 36-36 in the closing 30 seconds of the Father Duenas Alumni basketball Milestone Game, which was a friendly grudge match between the Class of 1974 and"
  },
  {
    "year": 2008,
    "publishedAt": "2008-07-10",
    "source": "PostGuam",
    "title": "FDMS Alumni Basketball Tournament begins tomorrow",
    "url": "https://www.postguam.com/sports/local/fdms-alumni-basketball-tournament-begins-tomorrow/article_9aeccdf9-1071-52c5-b595-4bb65084c9de.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/custom/image/f433efec-b17a-11eb-bb56-6f9f445e39b2.jpg?resize=600%2C336",
    "excerpt": "THE FATHER Duenas Memorial School Class of 1998 is proud to announce the commencement of the 2008 FDMS Alumni Basketball Tournament, which is set to begin bright and early tomorrow"
  },
  {
    "year": 2008,
    "publishedAt": "2008-07-16",
    "source": "PostGuam",
    "title": "’99/’97 survives against ’01, 49-43",
    "url": "https://www.postguam.com/sports/local/99-97-survives-against-01-49-43/article_da3c3bf6-dd59-5811-bd64-0509848c6384.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/8/20/820424c6-7606-5cf7-b3db-c398c1f1eb01/566af8add32af.image.jpg?crop=225%2C225%2C0%2C37&resize=200%2C200&order=crop%2Cresize",
    "excerpt": "DAY five of the 2008 Father Duenas Memorial School Alumni Basketball Tournament went down last night at “the Jungle” in Mangilao with another triple header."
  },
  {
    "year": 2008,
    "publishedAt": "2008-07-29",
    "source": "PostGuam",
    "title": "’99/’97 downs ’02, 44-35: ’95 set to challenge ’99/’97 for title",
    "url": "https://www.postguam.com/sports/local/99-97-downs-02-44-35-95-set-to-challenge-99-97-for-title/article_d0c41798-5f84-5448-97d0-5d8c7aa60330.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/a/61/a61a1885-3de9-5c50-b6ec-b6e91d1b7e6f/566af90c47e04.image.jpg?crop=231%2C231%2C34%2C0&resize=200%2C200&order=crop%2Cresize",
    "excerpt": "AFTER weeks of fast paced action in the 2008 Father Duenas Memorial School Alumni Basketball Tournament, it all came down to the final four squads as intense semifinal action unfolded"
  },
  {
    "year": 2025,
    "publishedAt": "2025-07-19",
    "source": "GuamPDN",
    "title": "Team '02/'04 earns 4th FD alumni crown after win against class of 2013",
    "url": "https://www.guampdn.com/sports/team-02-04-earns-4th-fd-alumni-crown-after-win-against-class-of-2013/article_d994f2ca-fc6e-4d76-974f-4b6716c4d7ea.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/2/5a/25acebb0-e7dc-4cbe-a956-c484a3c268a0/687b2870ee699.image.png?crop=1024%2C538%2C0%2C72",
    "excerpt": "The combined classes of 2002 & 2004 defeated the class of 2013 to win their fourth Father Dueñas Alumni Basketball championship as a group."
  },
  {
    "year": 2025,
    "publishedAt": "2025-07-17",
    "source": "GuamPDN",
    "title": "FD alumni basketball tournament coming to a close",
    "url": "https://www.guampdn.com/sports/fd-alumni-basketball-tournament-coming-to-a-close/article_20910fef-aa5c-4870-b0fc-766167e38dba.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/8/66/866be33e-3dae-11ef-88c3-033c4112810d/668cc12e0f317.image.png?crop=1193%2C626%2C0%2C84",
    "excerpt": "Summer is here and on Guam, that means BBQs, basketball, and reconnecting with old friends."
  },
  {
    "year": 2025,
    "publishedAt": "2025-06-30",
    "source": "GuamPDN",
    "title": "FD alumni basketball tournament opens with a bang",
    "url": "https://www.guampdn.com/sports/fd-alumni-basketball-tournament-opens-with-a-bang/article_f5598b72-ddd2-44b4-83fa-b0864fde94ed.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/6/00/600744c0-c2b1-46d6-9760-fc55af61c589/68621e440d2dc.image.png?crop=1191%2C625%2C0%2C82",
    "excerpt": "The Father Duenas Memorial School Alumni Tournament kicked off on Friday night with a not too surprising upset."
  },
  {
    "year": 2024,
    "publishedAt": "2024-07-20",
    "source": "GuamPDN",
    "title": "Shimizu sinks game winner, 16/17 wins FD alumni tournament",
    "url": "https://www.guampdn.com/sports/shimizu-sinks-game-winner-16-17-wins-fd-alumni-tournament/article_33f3a928-462a-11ef-b1e2-6f95570cec09.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/6/a7/6a7d1ad2-462b-11ef-b009-0f73a37c4a48/669afeaf91248.image.png?crop=1763%2C926%2C0%2C124&resize=1200%2C630&order=crop%2Cresize",
    "excerpt": "Add Leon Shimizu to the legends list of the heralded FD Alumni Basketball Tournament."
  },
  {
    "year": 2022,
    "publishedAt": "2022-06-16",
    "source": "GuamPDN",
    "title": "FD Alumni Basketball Tournament kicks off June 24",
    "url": "https://www.guampdn.com/sports/fd-alumni-basketball-tournament-kicks-off-june-24/article_ce5e5730-ed33-11ec-80be-a3074b11137d.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/1/c2/1c26d158-ed3a-11ec-8310-9bc7c5a7fda4/62aac8bc8744c.image.jpg?crop=1200%2C630%2C0%2C58",
    "excerpt": "The Father Dueñas Memorial School class of 2006 will attempt to defend, and win an unprecedented ninth title at the annual FD Alumni Basketball Tournament, scheduled to start June 24"
  },
  {
    "year": 2017,
    "publishedAt": "2017-07-12",
    "source": "GuamPDN",
    "title": "2006 to square off with 2002/4 at FD Alumni basketball tournament finals",
    "url": "https://www.guampdn.com/sports/2006-to-square-off-with-2002-4-at-fd-alumni-basketball-tournament-finals/article_cffcb7ee-7630-5e80-88c6-639fa2efb1b7.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/custom/image/d1d0565a-bcb2-11eb-8535-ab06d41ce483.jpg?resize=600%2C315",
    "excerpt": "The 2017 FDAA Basketball tournament championship game is set, as the 6-time champs of 2006 will square off against the new combined powerhouse of 2002/2004. The championship is scheduled for"
  },
  {
    "year": 2023,
    "publishedAt": "2023-07-19",
    "source": "GuamPDN",
    "title": "FD Friars Alumni Tournament in final days",
    "url": "https://www.guampdn.com/sports/fd-friars-alumni-tournament-in-final-days/article_39cf3a9c-25ec-11ee-8915-f31eed85791b.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/5/5d/55d5ef64-25ed-11ee-9026-9f03c985eb90/64b7677940773.image.jpg?crop=1589%2C834%2C0%2C234&resize=1200%2C630&order=crop%2Cresize",
    "excerpt": "After weeks of barbecue, beverages, brotherhood and yes, basketball, the FDMS Alumni Summer Tournament is coming to a close, following its penultimate set of games on Wednesday night."
  },
  {
    "year": 2023,
    "publishedAt": "2023-07-17",
    "source": "GuamPDN",
    "title": "FD alumni hoops playoff recap",
    "url": "https://www.guampdn.com/sports/fd-alumni-hoops-playoff-recap/article_c80ab5e0-2473-11ee-aa53-eb117b27b1ec.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/d/68/d68c36f4-fa83-11ec-a417-c3566bd738ca/62c112f4d93b9.image.jpg?crop=1548%2C813%2C0%2C263&resize=1200%2C630&order=crop%2Cresize",
    "excerpt": "Playoff weekend has begun for the 2023 FD Alumni Tournament. More than half of the competition was knocked over the weekend, and the climactic championship is fast approaching."
  },
  {
    "year": 2024,
    "publishedAt": "2024-07-10",
    "source": "GuamPDN",
    "title": "FD alumni basketball hits halfway point",
    "url": "https://www.guampdn.com/sports/fd-alumni-basketball-hits-halfway-point/article_16e92774-3dae-11ef-a703-3b80c0bd0c0c.html",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/guampdn.com/content/tncms/assets/v3/editorial/d/18/d183e9fc-3dae-11ef-bdb1-c7aa51df61e4/668cc1ac0be40.image.png?crop=1058%2C555%2C0%2C74",
    "excerpt": "The annual FD Basketball Alumni Tournament has hit the halfway mark with games going on nightly and a slew of action on the weekends."
  }
]

export const EXTRA_ARCHIVE_MEDIA: ArchiveMedia[] = [
  {
    "year": 2022,
    "source": "PostGuam",
    "title": "2022 FD Alumni Championship photo 1",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/a/59/a59021e4-0485-11ed-bdfc-6f8007f30b71/62d1dcf54eeb1.image.png?resize=687%2C500",
    "articleUrl": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "caption": "02/04 defeated 2020 62-52 in the 2022 FD Alumni Basketball Tournament championship. Photos credited in source to Matua Salas/GSPN.",
    "takenAt": "2022-07-15"
  },
  {
    "year": 2022,
    "source": "PostGuam",
    "title": "2022 FD Alumni Championship photo 2",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/b/a1/ba150030-0485-11ed-9ca2-4b1a6cf1038d/62d1dd17b6bff.image.png?resize=814%2C500",
    "articleUrl": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "caption": "02/04 defeated 2020 62-52 in the 2022 FD Alumni Basketball Tournament championship. Photos credited in source to Matua Salas/GSPN.",
    "takenAt": "2022-07-15"
  },
  {
    "year": 2022,
    "source": "PostGuam",
    "title": "2022 FD Alumni Championship photo 3",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/9/f2/9f2b01ac-0485-11ed-ab9b-6318ec52cda5/62d1dcea9113d.image.png?resize=884%2C500",
    "articleUrl": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "caption": "02/04 defeated 2020 62-52 in the 2022 FD Alumni Basketball Tournament championship. Photos credited in source to Matua Salas/GSPN.",
    "takenAt": "2022-07-15"
  },
  {
    "year": 2022,
    "source": "PostGuam",
    "title": "2022 FD Alumni Championship photo 4",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/a/b3/ab303f26-0485-11ed-a6c7-033be20f89c0/62d1dcfeb9dfb.image.png?resize=839%2C500",
    "articleUrl": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "caption": "02/04 defeated 2020 62-52 in the 2022 FD Alumni Basketball Tournament championship. Photos credited in source to Matua Salas/GSPN.",
    "takenAt": "2022-07-15"
  },
  {
    "year": 2022,
    "source": "PostGuam",
    "title": "2022 FD Alumni Championship photo 5",
    "imageUrl": "https://bloximages.newyork1.vip.townnews.com/postguam.com/content/tncms/assets/v3/editorial/b/22/b2246eb0-0485-11ed-b643-fb57f8261281/62d1dd0a68877.image.png?resize=892%2C500",
    "articleUrl": "https://www.postguam.com/sports/local/estella-perez-stinnett-lead-02-04-to-5th-fd-alumni-basketball-title/article_42dae3f0-0484-11ed-a886-ff9d4c4c7fe5.html",
    "caption": "02/04 defeated 2020 62-52 in the 2022 FD Alumni Basketball Tournament championship. Photos credited in source to Matua Salas/GSPN.",
    "takenAt": "2022-07-15"
  }
]


export const CHAMPION_RECORDS: ChampionRecord[] = [
  { year: 2025, champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50-44', source: 'GSPN / GuamPDN' },
  { year: 2024, champion: 'Class of 2016/17', runnerUp: 'Class of 2013', score: '58-56', source: 'GSPN / GuamPDN' },
  { year: 2023, champion: 'Class of 2013', source: 'GSPN' },
  { year: 2022, champion: 'Class of 2002/04', runnerUp: 'Class of 2020', score: '62-52', source: 'GSPN / PostGuam' },
  { year: 2021, champion: 'Class of 2006', runnerUp: 'Class of 2002/04', score: '58-38', source: 'GSPN' },
  { year: 2020, status: 'cancelled', source: 'COVID-19', note: 'Tournament cancelled during COVID-19 period.' },
  { year: 2019, champion: 'Class of 2006', runnerUp: 'Class of 2009', score: '49-46', source: 'GSPN' },
  { year: 2018, champion: 'Class of 2002/04', runnerUp: 'Class of 2011/12', source: 'GSPN' },
  { year: 2017, champion: 'Class of 2002/04', runnerUp: 'Class of 2006', score: '48-46', source: 'GSPN' },
  { year: 2016, status: 'unknown', source: 'PostGuam', note: 'Tournament existed; only partial public online records recovered so far.' },
  { year: 2015, champion: 'Class of 2013', runnerUp: 'Class of 2004', score: '60-48', source: 'GSPN / PostGuam' },
  { year: 2014, champion: 'Class of 2004', source: 'GSPN' },
  { year: 2013, champion: 'Class of 2006', source: 'GSPN / historical champions list' },
  { year: 2012, champion: 'Class of 2006', source: 'GSPN / historical champions list' },
  { year: 2011, champion: 'Class of 2006', source: 'Historical champions list' },
  { year: 2010, champion: 'Class of 2006', source: 'Historical champions list' },
  { year: 2009, champion: 'Class of 2002', source: 'Historical champions list' },
  { year: 2008, champion: 'Class of 1995', source: 'PostGuam / historical champions list' },
  { year: 2007, champion: 'Class of 2006', source: 'Historical champions list' },
  { year: 2006, champion: 'Class of 2002/03', source: 'Historical champions list' },
  { year: 2005, champion: 'Class of 1991', source: 'Historical champions list' },
]

export const STATIC_TOURNAMENT_YEARS = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005,
] as const

export function archiveArticlesForYear(year: number): ArchiveArticle[] {
  return ARCHIVE_ARTICLES.filter((article) => article.year === year)
}

export function archiveMediaForYear(year: number): ArchiveMedia[] {
  const articleMedia = ARCHIVE_ARTICLES
    .filter((article) => article.year === year && article.imageUrl)
    .map((article) => ({
      year: article.year,
      source: article.source,
      title: article.title,
      imageUrl: article.imageUrl!,
      articleUrl: article.url,
      caption: article.excerpt,
      takenAt: article.publishedAt,
      tags: article.title.toLowerCase().includes('champ') || article.title.toLowerCase().includes('crown') || article.title.toLowerCase().includes('title') ? 'featured' : null,
    }))

  return [...articleMedia, ...EXTRA_ARCHIVE_MEDIA.filter((item) => item.year === year)]
}

export function championForYear(year: number): ChampionRecord | undefined {
  return CHAMPION_RECORDS.find((record) => record.year === year)
}

export function allArchiveSourcesForYear(year: number): string[] {
  return Array.from(new Set([
    ...archiveArticlesForYear(year).map((item) => item.source),
    ...archiveMediaForYear(year).map((item) => item.source),
  ])).sort()
}
