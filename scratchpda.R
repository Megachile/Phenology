tst <- agddt[1:10,]
tst$observed_on <- tst$obsdate
tst$Avg32 <- NA
tst <- lookUpAGDD(tst)
tst <- tst[,-28:-31]
