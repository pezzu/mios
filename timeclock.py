import kivy
from kivy.app import App
# from kivy.uix.widget import Widget
from kivy.properties import NumericProperty, StringProperty, ObjectProperty
# from kivy.clock import Clock
from kivy.uix.floatlayout import FloatLayout

import datetime

import tcservice
import settings


class StatEntry(FloatLayout):
    pass


class Statistics(FloatLayout):
    pass


class StatisticsHeader(FloatLayout):
    pass


class DailyStat(FloatLayout):
    pass        


class MainScreen(FloatLayout):
    name = ObjectProperty(None)
    status = ObjectProperty(None)
    dobtn = ObjectProperty(None)
    daily = ObjectProperty(None)
    stats = ObjectProperty(None)

    def to_datetime(self, isodate):        
        return datetime.datetime.strptime(isodate,'%Y-%m-%dT%H:%M:%S.%fZ') if isodate else None;


    def calc_daily(self, stats):
        stats_dt = [{'in': self.to_datetime(stat['in']), 'out': self.to_datetime(stat['out'])} for stat in stats]
        if stats_dt[-1] is None:
            stats_dt[-1] = datetime.datetime.today()
        
        daily = reduce(lambda x,y: x+y, [sdt['out'] - sdt['in'] for sdt in stats_dt])

        hours = daily.seconds // 3600
        minutes = (daily.seconds - hours*3600) // 60

        return '%2d:%02d'%(hours, minutes)


    def update(self):
        res = tcservice.get_info(settings.user)

        self.name.text = res['user']

        if res['clockedIn']:
            self.status.text = 'Clocked In' 
            self.dobtn.text = 'Clock Out'
        else:
            self.status.text = 'Clocked Out' 
            self.dobtn.text = 'Clock In'

        self.daily.hours.text = self.calc_daily(res['stats'])

        for entry, stat in zip(self.stats.entries.children[::-1], res['stats']):
            entry.time_in.text = self.to_datetime(stat['in']).strftime('%H:%M')
            if stat['out']:
                entry.time_out.text = self.to_datetime(stat['out']).strftime('%H:%M')


    def do_action(self):
        res = tcservice.loginout(settings.user, settings.password)


class TimeClockApp(App):
    def build(self):
        screen = MainScreen()
        screen.update()
        return screen 


TimeClockApp().run()