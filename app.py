from PyQt6.QtWidgets import QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton, QLineEdit, QLabel, QComboBox
from PyQt6.QtGui import QFont
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from balance import get_l, polar
import numpy as np
from PyQt6.QtCore import QRegularExpression
from PyQt6.QtGui import QRegularExpressionValidator

from matplotlib.patches import Circle
import mpl_toolkits.mplot3d.art3d as art3d


class Widget(QWidget):
    def __init__(self):
        super().__init__()
        self.fig1 = plt.figure()
        self.fig2 = plt.figure()

        self.canvas = FigureCanvas(self.fig1)
        self.canvas2 = FigureCanvas(self.fig2)
        self.axes = self.fig1.add_subplot(111, projection='3d')
        self.axes2 = self.fig2.add_subplot(111, projection='3d')

        self.setWindowTitle(
            "Калибровка и балансировка жёсткого двухопорного ротора")
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(['МО', 'ПК', 'ЛК', 'МОПК', 'ЛКМО', 'ДК'])

        self.mode_combo.currentTextChanged.connect(self.update_graph)

        reg_ex = QRegularExpression("[+-]?[0-9]+\.[0-9]+")
        float_validator = QRegularExpressionValidator(reg_ex, self)

#######################################################################################################
        layout = QHBoxLayout(self)
        calculus_layout = QVBoxLayout(self)
        calbal_layout = QHBoxLayout(self)

        layout_calibration = QVBoxLayout(self)
        title_calibration = QHBoxLayout(self)
        l_A1_layout_calibration = QHBoxLayout(self)
        l_12_layout_calibration = QHBoxLayout(self)
        l_2B_layout_calibration = QHBoxLayout(self)
        n_layout_calibration = QHBoxLayout(self)
        m_1_layout_calibration = QHBoxLayout(self)
        r_1_layout_calibration = QHBoxLayout(self)
        phi_1_layout_calibration = QHBoxLayout(self)
        m_2_layout_calibration = QHBoxLayout(self)
        r_2_layout_calibration = QHBoxLayout(self)
        phi_2_layout_calibration = QHBoxLayout(self)
        x_A_layout_calibration = QHBoxLayout(self)
        phi_A_layout_calibration = QHBoxLayout(self)
        x_B_layout_calibration = QHBoxLayout(self)
        phi_B_layout_calibration = QHBoxLayout(self)
        k_layout_calibration = QHBoxLayout(self)

        calculus_layout.addWidget(self.mode_combo)

        layout_calibration.addLayout(title_calibration)
        layout_calibration.addLayout(l_A1_layout_calibration)
        layout_calibration.addLayout(l_12_layout_calibration)
        layout_calibration.addLayout(l_2B_layout_calibration)
        layout_calibration.addLayout(n_layout_calibration)
        layout_calibration.addLayout(m_1_layout_calibration)
        layout_calibration.addLayout(r_1_layout_calibration)
        layout_calibration.addLayout(phi_1_layout_calibration)
        layout_calibration.addLayout(m_2_layout_calibration)
        layout_calibration.addLayout(r_2_layout_calibration)
        layout_calibration.addLayout(phi_2_layout_calibration)
        layout_calibration.addLayout(x_A_layout_calibration)
        layout_calibration.addLayout(phi_A_layout_calibration)
        layout_calibration.addLayout(x_B_layout_calibration)
        layout_calibration.addLayout(phi_B_layout_calibration)
        layout_calibration.addLayout(k_layout_calibration)

        title_label_calibration = QLabel('Калибровка')
        title_label_calibration.setFont(QFont('Arial', 12))

        l_A1_label_calibration = QLabel('l_A1: ')
        l_12_label_calibration = QLabel('l_12: ')
        l_2B_label_calibration = QLabel('l_2B: ')
        n_label_calibration = QLabel('Частота вращения, [об\мин]: ')
        m_1_label_calibration = QLabel('Масса груза 1, [г]: ')
        r_1_label_calibration = QLabel('Радиус груза 1, [мм]: ')
        phi_1_label_calibration = QLabel('Фаза груза 1, [град]: ')
        m_2_label_calibration = QLabel('Масса груза 2, [г]: ')
        r_2_label_calibration = QLabel('Радиус груза 2, [мм]: ')
        phi_2_label_calibration = QLabel('Фаза груза 2, [град]: ')
        x_A_label_calibration = QLabel('x_A: ')
        phi_A_label_calibration = QLabel('phi_A: ')
        x_B_label_calibration = QLabel('x_B: ')
        phi_B_label_calibration = QLabel('phi_B: ')

        self.k_A_label_calibration = QLabel('k_A:',)
        self.k_B_label_calibration = QLabel('k_B:')

        self.k_A_label_calibration.setMaximumHeight(20)
        self.k_A_label_calibration.setFont(QFont('Arial', 12))
        self.k_B_label_calibration.setFont(QFont('Arial', 12))

        self.k_B_label_calibration.setMaximumHeight(20)

        title_label_calibration.setMaximumHeight(20)

        self.l_A1_edit_calibration = QLineEdit(text='75')
        self.l_12_edit_calibration = QLineEdit(text='195')
        self.l_2B_edit_calibration = QLineEdit(text='265')
        self.n_edit_calibration = QLineEdit(text='1506')
        self.m_1_edit_calibration = QLineEdit(text='2.667')
        self.r_1_edit_calibration = QLineEdit(text='62')
        self.phi_1_edit_calibration = QLineEdit(text='190')
        self.m_2_edit_calibration = QLineEdit(text='2.667')
        self.r_2_edit_calibration = QLineEdit(text='62')
        self.phi_2_edit_calibration = QLineEdit(text='190')
        self.x_A_edit_calibration = QLineEdit(text='6.6')
        self.phi_A_edit_calibration = QLineEdit(text='83')
        self.x_B_edit_calibration = QLineEdit(text='7')
        self.phi_B_edit_calibration = QLineEdit(text='85')

        self.l_A1_edit_calibration.setValidator(float_validator)
        self.l_12_edit_calibration.setValidator(float_validator)
        self.l_2B_edit_calibration.setValidator(float_validator)
        self.n_edit_calibration.setValidator(float_validator)
        self.m_1_edit_calibration.setValidator(float_validator)
        self.r_1_edit_calibration.setValidator(float_validator)
        self.phi_1_edit_calibration.setValidator(float_validator)
        self.m_2_edit_calibration.setValidator(float_validator)
        self.r_2_edit_calibration.setValidator(float_validator)
        self.phi_2_edit_calibration.setValidator(float_validator)
        self.x_A_edit_calibration.setValidator(float_validator)
        self.phi_A_edit_calibration.setValidator(float_validator)
        self.x_B_edit_calibration.setValidator(float_validator)
        self.phi_B_edit_calibration.setValidator(float_validator)

        self.l_A1_edit_calibration.textChanged.connect(self.update_graph)
        self.l_12_edit_calibration.textChanged.connect(self.update_graph)
        self.l_2B_edit_calibration.textChanged.connect(self.update_graph)
        self.n_edit_calibration.textChanged.connect(self.update_graph)
        self.m_1_edit_calibration.textChanged.connect(self.update_graph)
        self.r_1_edit_calibration.textChanged.connect(self.update_graph)
        self.phi_1_edit_calibration.textChanged.connect(self.update_graph)
        self.m_2_edit_calibration.textChanged.connect(self.update_graph)
        self.r_2_edit_calibration.textChanged.connect(self.update_graph)
        self.phi_2_edit_calibration.textChanged.connect(self.update_graph)
        self.x_A_edit_calibration.textChanged.connect(self.update_graph)
        self.phi_A_edit_calibration.textChanged.connect(self.update_graph)
        self.x_B_edit_calibration.textChanged.connect(self.update_graph)
        self.phi_B_edit_calibration.textChanged.connect(self.update_graph)

        title_calibration.addWidget(title_label_calibration)
        l_A1_layout_calibration.addWidget(l_A1_label_calibration)
        l_A1_layout_calibration.addWidget(self.l_A1_edit_calibration)
        l_12_layout_calibration.addWidget(l_12_label_calibration)
        l_12_layout_calibration.addWidget(self.l_12_edit_calibration)
        l_2B_layout_calibration.addWidget(l_2B_label_calibration)
        l_2B_layout_calibration.addWidget(self.l_2B_edit_calibration)
        n_layout_calibration.addWidget(n_label_calibration)
        n_layout_calibration.addWidget(self.n_edit_calibration)
        m_1_layout_calibration.addWidget(m_1_label_calibration)
        m_1_layout_calibration.addWidget(self.m_1_edit_calibration)
        r_1_layout_calibration.addWidget(r_1_label_calibration)
        r_1_layout_calibration.addWidget(self.r_1_edit_calibration)
        phi_1_layout_calibration.addWidget(phi_1_label_calibration)
        phi_1_layout_calibration.addWidget(self.phi_1_edit_calibration)
        m_2_layout_calibration.addWidget(m_2_label_calibration)
        m_2_layout_calibration.addWidget(self.m_2_edit_calibration)
        r_2_layout_calibration.addWidget(r_2_label_calibration)
        r_2_layout_calibration.addWidget(self.r_2_edit_calibration)
        phi_2_layout_calibration.addWidget(phi_2_label_calibration)
        phi_2_layout_calibration.addWidget(self.phi_2_edit_calibration)
        x_A_layout_calibration.addWidget(x_A_label_calibration)
        x_A_layout_calibration.addWidget(self.x_A_edit_calibration)
        phi_A_layout_calibration.addWidget(phi_A_label_calibration)
        phi_A_layout_calibration.addWidget(self.phi_A_edit_calibration)
        x_B_layout_calibration.addWidget(x_B_label_calibration)
        x_B_layout_calibration.addWidget(self.x_B_edit_calibration)
        phi_B_layout_calibration.addWidget(phi_B_label_calibration)
        phi_B_layout_calibration.addWidget(self.phi_B_edit_calibration)
        k_layout_calibration.addWidget(self.k_A_label_calibration)
        k_layout_calibration.addWidget(self.k_B_label_calibration)

############################################################################
        layout_balancing = QVBoxLayout(self)
        title_balancing = QHBoxLayout(self)
        l_A1_layout_balancing = QHBoxLayout(self)
        l_12_layout_balancing = QHBoxLayout(self)
        l_2B_layout_balancing = QHBoxLayout(self)
        n_layout_balancing = QHBoxLayout(self)
        k_A_layout_balancing = QHBoxLayout(self)
        phi_A_layout_balancing = QHBoxLayout(self)
        k_B_layout_balancing = QHBoxLayout(self)
        phi_B_layout_balancing = QHBoxLayout(self)
        r_1_layout_balancing = QHBoxLayout(self)
        r_2_layout_balancing = QHBoxLayout(self)

        phi_1_layout_balancing = QHBoxLayout(self)
        m_layout_balancing = QHBoxLayout(self)

        layout_balancing.addLayout(title_balancing)
        layout_balancing.addLayout(l_A1_layout_balancing)
        layout_balancing.addLayout(l_12_layout_balancing)
        layout_balancing.addLayout(l_2B_layout_balancing)
        layout_balancing.addLayout(n_layout_balancing)
        layout_balancing.addLayout(k_A_layout_balancing)
        layout_balancing.addLayout(phi_A_layout_balancing)
        layout_balancing.addLayout(phi_1_layout_balancing)
        layout_balancing.addLayout(k_B_layout_balancing)
        layout_balancing.addLayout(phi_B_layout_balancing)
        layout_balancing.addLayout(r_1_layout_balancing)

        layout_balancing.addLayout(r_2_layout_balancing)

        layout_balancing.addLayout(m_layout_balancing)

        title_label_balancing = QLabel('Балансировка')
        title_label_balancing.setFont(QFont('Arial', 12))

        l_A1_label_balancing = QLabel('l_A1: ')
        l_12_label_balancing = QLabel('l_12: ')
        l_2B_label_balancing = QLabel('l_2B: ')
        n_label_balancing = QLabel('Частота вращения, [об\мин]: ')
        k_A_label_balancing = QLabel('Жёсткость в опоре A, []: ')
        phi_A_label_balancing = QLabel('Фаза в опоре A, [град]: ')
        k_B_label_balancing = QLabel('Жёсткость в опоре B, []: ')
        phi_B_label_balancing = QLabel('Фаза в опоре A, [град]: ')

        r_1_label_balancing = QLabel('r_1: ')
        phi_A_label_balancing = QLabel('phi_A: ')
        r_2_label_balancing = QLabel('r_2: ')
        phi_B_label_balancing = QLabel('phi_B: ')

        title_label_balancing.setMaximumHeight(20)

        self.l_A1_edit_balancing = QLineEdit(text='75')
        self.l_12_edit_balancing = QLineEdit(text='195')
        self.l_2B_edit_balancing = QLineEdit(text='265')
        self.n_edit_balancing = QLineEdit(text='1506')
        self.k_A_edit_balancing = QLineEdit(text='1')
        self.phi_A_edit_balancing = QLineEdit(text='0')
        self.k_B_edit_balancing = QLineEdit(text='1')
        self.phi_B_edit_balancing = QLineEdit(text='0')
        self.r_1_edit_balancing = QLineEdit(text='1')
        self.r_2_edit_balancing = QLineEdit(text='1')

        self.l_A1_edit_balancing.setValidator(float_validator)
        self.l_12_edit_balancing.setValidator(float_validator)
        self.l_2B_edit_balancing.setValidator(float_validator)
        self.n_edit_balancing.setValidator(float_validator)
        self.k_A_edit_balancing.setValidator(float_validator)
        self.phi_A_edit_balancing.setValidator(float_validator)
        self.k_B_edit_balancing.setValidator(float_validator)
        self.phi_B_edit_balancing.setValidator(float_validator)
        self.r_1_edit_balancing.setValidator(float_validator)
        self.r_2_edit_balancing.setValidator(float_validator)

        self.m_1_label_balancing = QLabel('m_1:',)
        self.m_2_label_balancing = QLabel('m_2:')

        self.m_1_label_balancing.setMaximumHeight(20)
        self.m_1_label_balancing.setFont(QFont('Arial', 12))
        self.m_2_label_balancing.setFont(QFont('Arial', 12))

        self.m_2_label_balancing.setMaximumHeight(20)

        self.l_A1_edit_balancing.textChanged.connect(self.update_graph)
        self.l_12_edit_balancing.textChanged.connect(self.update_graph)
        self.l_2B_edit_balancing.textChanged.connect(self.update_graph)
        self.n_edit_balancing.textChanged.connect(self.update_graph)
        self.k_A_edit_balancing.textChanged.connect(self.update_graph)
        self.phi_A_edit_balancing.textChanged.connect(self.update_graph)
        self.k_B_edit_balancing.textChanged.connect(self.update_graph)
        self.phi_B_edit_balancing.textChanged.connect(self.update_graph)
        self.r_1_edit_balancing.textChanged.connect(self.update_graph)
        self.r_2_edit_balancing.textChanged.connect(self.update_graph)

        title_balancing.addWidget(title_label_balancing)
        l_A1_layout_balancing.addWidget(l_A1_label_balancing)
        l_A1_layout_balancing.addWidget(self.l_A1_edit_balancing)
        l_12_layout_balancing.addWidget(l_12_label_balancing)
        l_12_layout_balancing.addWidget(self.l_12_edit_balancing)
        l_2B_layout_balancing.addWidget(l_2B_label_balancing)
        l_2B_layout_balancing.addWidget(self.l_2B_edit_balancing)
        n_layout_balancing.addWidget(n_label_balancing)
        n_layout_balancing.addWidget(self.n_edit_balancing)
        k_A_layout_balancing.addWidget(k_A_label_balancing)
        k_A_layout_balancing.addWidget(self.k_A_edit_balancing)
        phi_A_layout_balancing.addWidget(phi_A_label_balancing)
        phi_A_layout_balancing.addWidget(self.phi_A_edit_balancing)
        k_B_layout_balancing.addWidget(k_B_label_balancing)
        k_B_layout_balancing.addWidget(self.k_B_edit_balancing)

        phi_B_layout_balancing.addWidget(phi_B_label_balancing)
        phi_B_layout_balancing.addWidget(self.phi_B_edit_balancing)
        r_1_layout_balancing.addWidget(r_1_label_balancing)
        r_1_layout_balancing.addWidget(self.r_1_edit_balancing)
        r_2_layout_balancing.addWidget(r_2_label_balancing)
        r_2_layout_balancing.addWidget(self.r_2_edit_balancing)
        m_layout_balancing.addWidget(self.m_1_label_balancing)
        m_layout_balancing.addWidget(self.m_2_label_balancing)


#########################################################################
        layout_graph = QVBoxLayout(self)
        layout_graph.addWidget(self.canvas)
        layout_graph.addWidget(self.canvas2)
######################################################

        layout.addLayout(calculus_layout)
        calculus_layout.addLayout(calbal_layout)
        calbal_layout.addLayout(layout_calibration)
        calbal_layout.addLayout(layout_balancing)
        layout.addLayout(layout_graph)
        self.update_graph()

    def update_graph(self):

        self.axes.cla()
        self.axes2.cla()

        try:
            a = float(self.l_A1_edit_calibration.text())
            b = float(self.l_12_edit_calibration.text())
            c = float(self.l_2B_edit_calibration.text())
            n = float(self.n_edit_calibration.text())
            m_1 = float(self.m_1_edit_calibration.text())
            r_1 = float(self.r_1_edit_calibration.text())
            phi_1 = float(self.phi_1_edit_calibration.text())
            m_2 = float(self.m_2_edit_calibration.text())
            r_2 = float(self.r_2_edit_calibration.text())
            phi_2 = float(self.phi_2_edit_calibration.text())
            x_A = float(self.x_A_edit_calibration.text())
            phi_A = float(self.phi_A_edit_calibration.text())
            x_B = float(self.x_B_edit_calibration.text())
            phi_B = float(self.phi_B_edit_calibration.text())
            k_A_bal = float(self.k_A_edit_balancing.text())
            phi_A_bal = float(self.phi_A_edit_balancing.text())
            k_B_bal = float(self.k_B_edit_balancing.text())
            phi_B_bal = float(self.phi_B_edit_balancing.text())
            r_1_bal = float(self.r_1_edit_balancing.text())
            r_2_bal = float(self.r_2_edit_balancing.text())

            R_1 = polar(r_1, phi_1)
            R_2 = polar(r_2, phi_2)
            x_A = polar(x_A, phi_A)
            x_B = polar(x_B, phi_B)

            w = 2 * np.pi * n / 60

            z_A = 0
            match self.mode_combo.currentText():
                case 'МО':
                    z_1, z_2, z_B = get_l('mo', a, b, c)
                case 'ПК':
                    z_1, z_2, z_B = get_l('pk', a, b, c)
                case 'ЛК':
                    z_1, z_2, z_B = get_l('lk', a, b, c)
                case 'МОПК':
                    z_1, z_2, z_B = get_l('mopk', a, b, c)
                case 'ЛКМО':
                    z_1, z_2, z_B = get_l('lkmo', a, b, c)
                case 'ДК':
                    z_1, z_2, z_B = get_l('dk', a, b, c)

            T_1 = m_1*R_1
            T_2 = m_2*R_2

            D_1 = T_1*w**2*1e-6
            D_2 = T_2*w**2*1e-6

            D_A = (D_1*(z_1-z_B)+D_2*(z_2-z_B))/(z_A-z_B)
            D_B = (D_1*(z_1-z_A)+D_2*(z_2-z_A))/(z_B-z_A)

            k_A = D_A/x_A
            k_B = D_B/x_B
            self.k_A_label_calibration.setText(
                f'k<sub>A</sub>= {np.abs(k_A):.2f}{chr(215)}{np.rad2deg(np.angle(k_A))%360:.2f}{chr(176)}')
            self.k_B_label_calibration.setText(
                f'k<sub>B</sub>= {np.abs(k_B):.2f}{chr(215)}{np.rad2deg(np.angle(k_B))%360:.2f}{chr(176)}')

            z_min = np.min([z_A, z_B, z_1, z_2])
            z_max = np.max([z_A, z_B, z_1, z_2])

            self.axes.plot([0, 0], [z_min, z_max], [0, 0], lw=5, color='k')
            self.axes.plot([0, D_A.real], [z_A, z_A], [0, D_A.imag],
                           color='red', marker='o', markersize=5)
            self.axes.plot([0, D_B.real], [z_B, z_B], [0, D_B.imag],
                           color='red', marker='o', markersize=5)
            self.axes.plot([0, D_1.real], [z_1, z_1], [0, D_1.imag],
                           color='blue', marker='o', markersize=5)
            self.axes.plot([0, D_2.real], [z_2, z_2], [0, D_2.imag],
                           color='blue', marker='o', markersize=5)
            p1 = Circle((0, 0), np.abs(D_A), color='red', alpha=0.2)
            p2 = Circle((0, 0), np.abs(D_1), color='blue', alpha=0.2)
            p3 = Circle((0, 0), np.abs(D_2), color='blue', alpha=0.2)
            p4 = Circle((0, 0), np.abs(D_B), color='red', alpha=0.2)

            self.axes.add_patch(p1)
            self.axes.add_patch(p2)
            self.axes.add_patch(p3)
            self.axes.add_patch(p4)

            art3d.pathpatch_2d_to_3d(p1, z=z_A, zdir="y")
            art3d.pathpatch_2d_to_3d(p2, z=z_1, zdir="y")
            art3d.pathpatch_2d_to_3d(p3, z=z_2, zdir="y")
            art3d.pathpatch_2d_to_3d(p4, z=z_B, zdir="y")

            max = np.max(np.abs([D_A, D_1, D_2, D_B]))
            self.axes.set_xlim(-max, max)
            self.axes.set_zlim(-max, max)
            self.axes.text(0, z_A, 0.15*max, r'$z_A$')
            self.axes.text(0, z_1, 0.15*max, r'$z_1$')
            self.axes.text(0, z_2, 0.15*max, r'$z_2$')
            self.axes.text(0, z_B, 0.15*max, r'$z_B$')
            self.axes.set_ylabel('z, [мм]')
            self.axes.set_title('Пересчёт дисбалансов')
            self.axes.set_box_aspect([1, 1.25, 1])

            D_A = polar(k_A_bal, phi_A_bal)*x_A
            D_B = polar(k_B_bal, phi_B_bal)*x_B

            D_1 = (D_A*(z_A-z_2)+D_B*(z_B-z_2))/(z_1-z_2)
            D_2 = (D_A*(z_A-z_1)+D_B*(z_B-z_1))/(z_2-z_1)

            M_1 = D_1 * 1e+6 / (w ** 2 * r_1_bal)
            M_2 = D_2 * 1e+6 / (w ** 2 * r_2_bal)

            self.m_1_label_balancing.setText(
                f'm<sub>1</sub>= {np.abs(M_1):.2f}{chr(215)}{np.rad2deg(np.angle(M_1))%360:.2f}{chr(176)}')
            self.m_2_label_balancing.setText(
                f'm<sub>2</sub>= {np.abs(M_2):.2f}{chr(215)}{np.rad2deg(np.angle(M_2))%360:.2f}{chr(176)}')

            z_min = np.min([z_A, z_B, z_1, z_2])
            z_max = np.max([z_A, z_B, z_1, z_2])
            self.axes2.plot([0, 0], [z_min, z_max], [0, 0], lw=5, color='k')
            self.axes2.plot([0, polar(r_1_bal, np.rad2deg(np.angle(M_1))).real], [z_1, z_1], [0, polar(r_1_bal, np.rad2deg(np.angle(M_1))).imag],
                            color='red', marker='o', markersize=5)
            self.axes2.plot([0, polar(r_2_bal, np.angle(M_2)).real], [z_2, z_2], [0, polar(r_2_bal, np.angle(M_2)).imag],
                            color='red', marker='o', markersize=5)

            p5 = Circle((0, 0), r_1_bal, color='blue', alpha=0.2)
            p6 = Circle((0, 0), r_2_bal, color='blue', alpha=0.2)

            self.axes2.add_patch(p5)
            self.axes2.add_patch(p6)

            art3d.pathpatch_2d_to_3d(p5, z=z_1, zdir="y")
            art3d.pathpatch_2d_to_3d(p6, z=z_2, zdir="y")

            max2 = np.max([r_1_bal, r_2_bal])
            self.axes2.set_xlim(-max2, max2)
            self.axes2.set_zlim(-max2, max2)
            self.axes2.text(0, z_A, 0.15*max2, r'$z_A$')
            self.axes2.text(0, z_1, 0.15*max2, r'$z_1$')
            self.axes2.text(0, z_2, 0.15*max2, r'$z_2$')
            self.axes2.text(0, z_B, 0.15*max2, r'$z_B$')
            self.axes2.set_xlabel('x, [мм]')
            self.axes2.set_ylabel('z, [мм]')
            self.axes2.set_zlabel('y, [мм]')

            self.axes2.set_title('Расчёт грузов')
            self.axes2.set_box_aspect([1, 1.25, 1])
            self.canvas.draw()

            self.canvas2.draw()
        except:
            pass


if __name__ == "__main__":
    app = QApplication([])
    win = Widget()
    win.show()
    app.exec()
