// point de vue concret : le dîner pn-philosophers-5 par la
//      lentille Petri + positions — les cinq philosophes en
//      colonnes, les fourchettes entre eux
layer pn-philosophers-5-course refines @petrinet-view
  override model = @pn-philosophers-5
  override zoom = "mecanisme"
  positions
    philo1.think1
      x = 60
      y = 50
    philo1.fork1
      x = 60
      y = 110
    philo1.eat1
      x = 60
      y = 170
    philo1.take1
      x = 210
      y = 50
    philo1.release1
      x = 210
      y = 170
    philo2.think1
      x = 280
      y = 50
    philo2.fork1
      x = 280
      y = 110
    philo2.eat1
      x = 280
      y = 170
    philo2.take1
      x = 430
      y = 50
    philo2.release1
      x = 430
      y = 170
    philo3.think1
      x = 500
      y = 50
    philo3.fork1
      x = 500
      y = 110
    philo3.eat1
      x = 500
      y = 170
    philo3.take1
      x = 650
      y = 50
    philo3.release1
      x = 650
      y = 170
    philo4.think1
      x = 720
      y = 50
    philo4.fork1
      x = 720
      y = 110
    philo4.eat1
      x = 720
      y = 170
    philo4.take1
      x = 870
      y = 50
    philo4.release1
      x = 870
      y = 170
    philo5.think1
      x = 940
      y = 50
    philo5.fork1
      x = 940
      y = 110
    philo5.eat1
      x = 940
      y = 170
    philo5.take1
      x = 1090
      y = 50
    philo5.release1
      x = 1090
      y = 170
