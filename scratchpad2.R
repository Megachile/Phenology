bkins <- iNatgall(url)
unique(bkins$Host_Plant_ID)
bkimp <- PrepGallAppend(bkins)
bkimp <- lookUpAGDD(bkimp)

bkan <- bkimp
bkan$generation <- dbGetQuery(gallphen, str_interp("SELECT generation FROM species WHERE "))
doyLatRanges2gen(bkimp,eas)

x <- x[!(x$phenophase=="Adult"&x$generation==bisexual),]



write.csv(bkimp,paste0(wd,"/bkinAGDD.csv"))

anom <- bkimp[bkimp$phenophase=="",]

anom <- anom[(anom$latitude>agamlowslope*anom$doy+agamlowyint),]

for (i in 1:20){
  browseURL(anom$pageURL[i])
}

bkimp[bkimp$pageURL=="https://www.inaturalist.org/observations/32128780",6] <- "developing"
bkimp <- bkimp[!bkimp$pageURL=="https://www.inaturalist.org/observations/112443014",]

