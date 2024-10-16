import numpy as np
import matplotlib.pyplot as plt

def polar(amp, ph):
    return amp*np.exp(np.deg2rad(ph)*1j)

def get_l(mode, a, b, c):
    # функция переводит расстояния между точками в расстояние от точки А в зависимости от выбранной схемы балансировки
    # Входные параметры:
    # select - str - значение выбранной схемы
    # a,b,c - расстояния между плоскостями балансировки
    # a: A-1
    # b: 1-2
    # c: 2-B
    match mode:

        case 'mo':
            l_1 = a
            l_2 = a + b
            l = a + b + c

        case 'pk':
            l_1 = a
            l_2 = a + b
            l = a + b - c

        case 'lk':
            l_1 = -a
            l_2 = b - a
            l = b + c - a

        case 'mopk':
            l_1 = a
            l_2 = a + b
            l = a + b - c

        case 'lkmo':
            l_1 = -a
            l_2 = b - a
            l = b + c - a
           

        case 'dk':
            l_1 = -a
            l_2 = b - a
            l = b - c - a
    return l_1, l_2, l


R_1 = polar(62, -20)
m_1 = 2.667

R_2 = polar(62, 170)
m_2 = 2.667

a = 75
b = 195
c = 265

n = 1506

x_A = polar(6.6, 40)
x_B = polar(7, 50)

h = 5
q = 1


w = 2 * np.pi * n / 60

z_A = 0
z_1, z_2, z_B = get_l('mo', a, b, c)

T_1 = m_1*R_1
T_2 = m_2*R_2

D_1 = T_1*w**2*1e-6
D_2 = T_2*w**2*1e-6

D_A = (D_1*(z_1-z_B)+D_2*(z_2-z_B))/(z_A-z_B)
D_B = (D_1*(z_1-z_A)+D_2*(z_2-z_A))/(z_B-z_A)

k_A = D_A/x_A
k_B = D_B/x_B
  