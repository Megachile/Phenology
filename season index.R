library(solrad)
library(units)
library(stats)
library(pracma)
comb$daylength <- 2*acos(cos(set_units(90.833, "radians"))/(cos(set_units(comb$latitude, "radians"))*cos(set_units(Declination(comb$doy),"radians"))) - tan )/15

daylength <- 2*ha/15

thr <- 10.5
lat <- 45



eq = function(x,lat=45) {(2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-9}

# 
# x <- seq(0,250)
# y <- eq(x,lat,thr)
# x <- data

eas1 <- seasonIndex(eas)
data1 <- seasonIndex(data)
x <- data
y <- eas1

x <- data
y <- eas1



x <- data1
y <- doyLatPercentEq(data1,eas1)
y <- doyLatSeasEq(data1,eas1)

p = ggplot(data = x, aes(x = doy, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
  geom_point()+
  geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
  geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
p


doyLatPlot(data1, y)

plot(data1$percent50~data1$seasind)

ggplot(data.frame(x=c(0, 365)), aes(x=x)) + 
  stat_function(fun=eq)

