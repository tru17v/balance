from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton, QLineEdit,
                             QLabel, QComboBox, QGroupBox, QSplitter, QGridLayout, QDoubleSpinBox)
from PyQt6.QtGui import QFont
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from balance import get_l, polar
import numpy as np
from PyQt6.QtCore import QRegularExpression, pyqtSignal
from PyQt6.QtGui import QRegularExpressionValidator
from itertools import count

from matplotlib.patches import Circle
import mpl_toolkits.mplot3d.art3d as art3d


class BaseGroupbox(QGroupBox):
    value_changed = pyqtSignal(float)

    def __init__(self, parent=None):
        super().__init__(parent)

        self.main_layout = QGridLayout()
        self.setLayout(self.main_layout)

    def add_row(self, row: int, label: str, default_value: float) -> QDoubleSpinBox:
        self.main_layout.addWidget(QLabel(label, self), row, 0)
        spinbox = QDoubleSpinBox(self)
        spinbox.setRange(-99999, 99999)
        spinbox.setValue(default_value)
        self.main_layout.addWidget(spinbox, row, 1)
        spinbox.valueChanged.connect(self.value_changed)
        return spinbox


class CalibratingGroupbox(BaseGroupbox):
    def __init__(self, parent=None):
        super().__init__(parent)

        self.setTitle('Калибровка')

        row_count = count(0, 1)

        self.l_A1_edit_calibration = self.add_row(next(row_count), 'Длина участка А-1, [мм], l<sub>A1</sub>: ', 75)
        self.l_12_edit_calibration = self.add_row(next(row_count), 'Длина участка 1-2, [мм], l<sub>12</sub>: ', 195)
        self.l_2B_edit_calibration = self.add_row(next(row_count), 'Длина участка 2-B, [мм], l<sub>2B</sub>: ', 265)
        self.n_edit_calibration = self.add_row(next(row_count), 'Частота вращения, [об\мин], n: ', 1500)
        self.m_1_edit_calibration = self.add_row(next(row_count), 'Масса груза 1, [г], m<sub>1</sub>: ', 2.667)
        self.r_1_edit_calibration = self.add_row(next(row_count), 'Радиус груза 1, [мм], R<sub>1</sub>: ', 62)
        self.phi_1_edit_calibration = self.add_row(next(row_count), f'Фаза груза 1, [град], {chr(966)}<sub>1</sub>: ', 190)
        self.m_2_edit_calibration = self.add_row(next(row_count), 'Масса груза 2, [г], m<sub>2</sub>: ', 2.667)
        self.r_2_edit_calibration = self.add_row(next(row_count), 'Радиус груза 2, [мм], R<sub>2</sub>: ', 62)
        self.phi_2_edit_calibration = self.add_row(next(row_count), f'Фаза груза 2, [град], {chr(966)}<sub>2</sub>: ', 190)
        self.x_A_edit_calibration = self.add_row(next(row_count), 'Вибрации в А, [мкм], x<sub>A</sub>: ', 6.6)
        self.phi_A_edit_calibration = self.add_row(next(row_count), f'Фаза вибрации в А, [град], {chr(966)}<sub>A</sub>: ', 83)
        self.x_B_edit_calibration = self.add_row(next(row_count), 'Вибрации в B, [мкм], x<sub>B</sub>: ', 7)
        self.phi_B_edit_calibration = self.add_row(next(row_count), f'Фаза вибрации в B, [град], {chr(966)}<sub>B</sub>: ', 85)


class BalancingGroupbox(BaseGroupbox):
    def __init__(self, parent=None):
        super().__init__(parent)

        self.setTitle('Балансировка')

        row_count = count(0, 1)

        self.l_A1_edit_balancing = self.add_row(next(row_count),'Длина участка А-1, [мм], l<sub>A1</sub>: ' ,75)
        self.l_12_edit_balancing = self.add_row(next(row_count),'Длина участка 1-2, [мм], l<sub>12</sub>: ' ,195)
        self.l_2B_edit_balancing = self.add_row(next(row_count),'Длина участка 2-B, [мм], l<sub>2B</sub>: ' ,265)
        self.n_edit_balancing = self.add_row(next(row_count),'Частота вращения, [об\мин], n: ' ,1500)
        self.k_A_edit_balancing = self.add_row(next(row_count),'Жёсткость в опоре A, [Н/мкм], k<sub>A</sub>: ' ,0.84)
        self.phi_A_edit_balancing = self.add_row(next(row_count),f'Фаза в опоре A, [град], {chr(966)}<sub>A</sub>: ' ,107)
        self.k_B_edit_balancing = self.add_row(next(row_count),'Жёсткость в опоре B, [Н/мкм], k<sub>B</sub>: ' ,0.38)
        self.phi_B_edit_balancing = self.add_row(next(row_count),f'Фаза в опоре B, [град], {chr(966)}<sub>B</sub>: ' ,105)
        self.r_1_edit_balancing = self.add_row(next(row_count),'Радиус груза 1, [мм], R<sub>1</sub>: ' ,62)
        self.r_2_edit_balancing = self.add_row(next(row_count), 'Радиус груза 2, [мм], R<sub>2</sub>: ' ,62)


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
        self.mode_identifiers = ('mo', 'pk', 'lk', 'mopk', 'lkmo', 'dk')

        self.mode_combo.currentIndexChanged.connect(self.update_graph)

        #######################################################################################################

        self.setLayout(QVBoxLayout())

        main_splitter = QSplitter()

        calculus_widget = QWidget(self)
        plots_widget = QWidget(self)

        calculus_widget.setLayout(QVBoxLayout())
        calculus_widget.layout().addWidget(self.mode_combo)
        groupboxes_layout = QHBoxLayout()
        calculus_widget.layout().addLayout(groupboxes_layout)

        self.calibration_groupbox = CalibratingGroupbox(self)
        self.balancing_groupbox = BalancingGroupbox(self)
        groupboxes_layout.addWidget(self.calibration_groupbox)
        groupboxes_layout.addWidget(self.balancing_groupbox)

        result_groupbox = QGroupBox(self)
        result_groupbox.setTitle('Результаты вычислений')
        result_layout = QGridLayout()
        result_groupbox.setLayout(result_layout)

        result_layout.addWidget(QLabel('k<sub>A</sub>=', self), 0, 0)
        result_layout.addWidget(QLabel('k<sub>B</sub>=', self), 1, 0)

        self.k_A_edit = QLineEdit(self)
        self.k_B_edit = QLineEdit(self)
        self.k_A_edit.setReadOnly(True)
        self.k_B_edit.setReadOnly(True)

        result_layout.addWidget(self.k_A_edit, 0, 1)
        result_layout.addWidget(self.k_B_edit, 1, 1)

        result_layout.addWidget(QLabel('m<sub>1</sub>=', self), 0, 2)
        result_layout.addWidget(QLabel('m<sub>2</sub>=', self), 1, 2)

        self.m_1_edit = QLineEdit(self)
        self.m_2_edit = QLineEdit(self)
        self.m_1_edit.setReadOnly(True)
        self.m_2_edit.setReadOnly(True)

        result_layout.addWidget(self.m_1_edit, 0, 3)
        result_layout.addWidget(self.m_2_edit, 1, 3)

        calculus_widget.layout().addWidget(result_groupbox)
        calculus_widget.layout().addStretch()

        #########################################################################
        plots_widget.setLayout(QVBoxLayout())
        plots_widget.layout().addWidget(self.canvas)
        plots_widget.layout().addWidget(self.canvas2)
        ######################################################

        main_splitter.addWidget(calculus_widget)
        main_splitter.addWidget(plots_widget)
        self.layout().addWidget(main_splitter)

        self.calibration_groupbox.value_changed.connect(self.update_graph)
        self.balancing_groupbox.value_changed.connect(self.update_graph)

        self.update_graph()

    def update_graph(self):

        self.axes.cla()
        self.axes2.cla()

        a = self.calibration_groupbox.l_A1_edit_calibration.value()
        b = self.calibration_groupbox.l_12_edit_calibration.value()
        c = self.calibration_groupbox.l_2B_edit_calibration.value()
        n = self.calibration_groupbox.n_edit_calibration.value()
        m_1 = self.calibration_groupbox.m_1_edit_calibration.value()
        r_1 = self.calibration_groupbox.r_1_edit_calibration.value()
        phi_1 = self.calibration_groupbox.phi_1_edit_calibration.value()
        m_2 = self.calibration_groupbox.m_2_edit_calibration.value()
        r_2 = self.calibration_groupbox.r_2_edit_calibration.value()
        phi_2 = self.calibration_groupbox.phi_2_edit_calibration.value()
        x_A = self.calibration_groupbox.x_A_edit_calibration.value()
        phi_A = self.calibration_groupbox.phi_A_edit_calibration.value()
        x_B = self.calibration_groupbox.x_B_edit_calibration.value()
        phi_B = self.calibration_groupbox.phi_B_edit_calibration.value()
        k_A_bal = self.balancing_groupbox.k_A_edit_balancing.value()
        phi_A_bal = self.balancing_groupbox.phi_A_edit_balancing.value()
        k_B_bal = self.balancing_groupbox.k_B_edit_balancing.value()
        phi_B_bal = self.balancing_groupbox.phi_B_edit_balancing.value()
        r_1_bal = self.balancing_groupbox.r_1_edit_balancing.value()
        r_2_bal = self.balancing_groupbox.r_2_edit_balancing.value()

        R_1 = polar(r_1, phi_1)
        R_2 = polar(r_2, phi_2)
        x_A = polar(x_A, phi_A)
        x_B = polar(x_B, phi_B)

        w = 2 * np.pi * n / 60

        z_A = 0
        z_1, z_2, z_B = get_l(self.mode_identifiers[self.mode_combo.currentIndex()], a, b, c)

        T_1 = m_1*R_1
        T_2 = m_2*R_2

        D_1 = T_1*w**2*1e-6
        D_2 = T_2*w**2*1e-6

        D_A = (D_1*(z_1-z_B)+D_2*(z_2-z_B))/(z_A-z_B)
        D_B = (D_1*(z_1-z_A)+D_2*(z_2-z_A))/(z_B-z_A)

        k_A = D_A/x_A
        k_B = D_B/x_B
        self.k_A_edit.setText(f'{np.abs(k_A):.2f}{chr(215)}{np.rad2deg(np.angle(k_A))%360:.2f}{chr(176)}')
        self.k_B_edit.setText(f'{np.abs(k_B):.2f}{chr(215)}{np.rad2deg(np.angle(k_B))%360:.2f}{chr(176)}')

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
        
        self.axes.plot([-np.abs(D_1), np.abs(D_1)], [z_1, z_1], [0, 0],
                color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([0, 0], [z_1, z_1], [-np.abs(D_1), np.abs(D_1)],
                color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([-np.abs(D_2), np.abs(D_2)], [z_2, z_2], [0, 0],
                color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([0, 0], [z_2, z_2], [-np.abs(D_2), np.abs(D_2)],
                color='blue', ls='-.',lw=1,alpha=0.4)
        
        self.axes.plot([-np.abs(D_A), np.abs(D_A)], [z_A, z_A], [0, 0],
                color='red', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([0, 0], [z_A, z_A], [-np.abs(D_A), np.abs(D_A)],
                color='red', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([-np.abs(D_B), np.abs(D_B)], [z_B, z_B], [0, 0],
                color='red', ls='-.',lw=1,alpha=0.4)
        self.axes.plot([0, 0], [z_B, z_B], [-np.abs(D_B), np.abs(D_B)],
                color='red', ls='-.',lw=1,alpha=0.4)
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
        self.axes.set_xlabel('x, [г$\cdot$мм]')
        self.axes.set_ylabel('z, [мм]')
        self.axes.set_zlabel('y, [г$\cdot$мм]')

        self.axes.set_title('Пересчёт дисбалансов')
        self.axes.set_box_aspect([1, 1.25, 1])

        D_A = polar(k_A_bal, phi_A_bal)*x_A
        D_B = polar(k_B_bal, phi_B_bal)*x_B

        D_1 = (D_A*(z_A-z_2)+D_B*(z_B-z_2))/(z_1-z_2)
        D_2 = (D_A*(z_A-z_1)+D_B*(z_B-z_1))/(z_2-z_1)

        M_1 = D_1 * 1e+6 / (w ** 2 * r_1_bal)
        M_2 = D_2 * 1e+6 / (w ** 2 * r_2_bal)

        self.m_1_edit.setText(f'{np.abs(M_1):.2f}{chr(215)}{np.rad2deg(np.angle(M_1))%360:.2f}{chr(176)}')
        self.m_2_edit.setText(f'{np.abs(M_2):.2f}{chr(215)}{np.rad2deg(np.angle(M_2))%360:.2f}{chr(176)}')

        z_min = np.min([z_A, z_B, z_1, z_2])
        z_max = np.max([z_A, z_B, z_1, z_2])
        self.axes2.plot([0, 0], [z_min, z_max], [0, 0], lw=5, color='k')
        self.axes2.plot([0, polar(r_1_bal, np.rad2deg(np.angle(M_1))).real], [z_1, z_1], [0, polar(r_1_bal, np.rad2deg(np.angle(M_1))).imag],
                        color='red', marker='o', markersize=5)
        self.axes2.plot([0, polar(r_2_bal, np.rad2deg(np.angle(M_2))).real], [z_2, z_2], [0, polar(r_2_bal, np.rad2deg(np.angle(M_2))).imag],
                        color='red', marker='o', markersize=5)
        self.axes2.plot([-r_1_bal, r_1_bal], [z_1, z_1], [0, 0],
                        color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes2.plot([0, 0], [z_1, z_1], [-r_1_bal, r_1_bal],
                color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes2.plot([-r_2_bal, r_2_bal], [z_2, z_2], [0, 0],
                color='blue', ls='-.',lw=1,alpha=0.4)
        self.axes2.plot([0, 0], [z_2, z_2], [-r_2_bal, r_2_bal],
                color='blue', ls='-.',lw=1,alpha=0.4)
        p5 = Circle((0, 0), r_1_bal, color='blue', alpha=0.2)
        p6 = Circle((0, 0), r_2_bal, color='blue', alpha=0.2)

        self.axes2.add_patch(p5)
        self.axes2.add_patch(p6)

        art3d.pathpatch_2d_to_3d(p5, z=z_1, zdir="y")
        art3d.pathpatch_2d_to_3d(p6, z=z_2, zdir="y")

        max2 = np.max([r_1_bal, r_2_bal])
        self.axes2.set_xlim(-max2, max2)
        self.axes2.set_zlim(-max2, max2)
        # self.axes2.text(0, z_A, 0.15*max2, r'$z_A$')
        self.axes2.text(0, z_1, 0.15*max2, r'$z_1$')
        self.axes2.text(0, z_2, 0.15*max2, r'$z_2$')
        # self.axes2.text(0, z_B, 0.15*max2, r'$z_B$')
        self.axes2.set_xlabel('x, [мм]')
        self.axes2.set_ylabel('z, [мм]')
        self.axes2.set_zlabel('y, [мм]')

        self.axes2.set_title('Расчёт грузов')
        self.axes2.set_box_aspect([1, 1.25, 1])
        self.canvas.draw()

        self.canvas2.draw()


if __name__ == "__main__":
    app = QApplication([])
    win = Widget()
    win.show()
    app.exec()
