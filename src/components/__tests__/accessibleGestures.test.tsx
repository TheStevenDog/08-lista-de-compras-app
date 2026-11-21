import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { ItemRow } from '../../db/types';
import { ListTitleHeader } from '../ListTitleHeader';
import { SwipeableProductRow } from '../SwipeableProductRow';

const sampleItem: ItemRow = {
  id: 10,
  lista_id: 1,
  nombre: 'Leche',
  cantidad: 2,
  categoria: 'lacteos',
  comprado: 0,
  orden: 0,
  remote_id: 'uuid-10',
  updated_at: '2026-11-20T12:00:00.000Z',
  deleted: 0,
  pending: 1,
};

describe('Accesibilidad de gestos (Sección 4)', () => {
  test('SwipeableProductRow expone botones alternativos con accessibilityLabel para comprar, reordenar y eliminar', () => {
    const onToggleComprado = jest.fn();
    const onDelete = jest.fn();
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();

    const { getByLabelText } = render(
      <SwipeableProductRow
        item={sampleItem}
        canMoveUp
        canMoveDown
        onToggleComprado={onToggleComprado}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );

    fireEvent.press(getByLabelText('Marcar Leche como comprado'));
    expect(onToggleComprado).toHaveBeenCalledWith(sampleItem);

    fireEvent.press(getByLabelText('Subir Leche en el orden del pasillo'));
    expect(onMoveUp).toHaveBeenCalledWith(sampleItem);

    fireEvent.press(getByLabelText('Bajar Leche en el orden del pasillo'));
    expect(onMoveDown).toHaveBeenCalledWith(sampleItem);

    fireEvent.press(getByLabelText('Eliminar Leche de la lista'));
    expect(onDelete).toHaveBeenCalledWith(sampleItem);
  });

  test('ListTitleHeader expone botón alternativo accesible para duplicar la lista', () => {
    const onDuplicate = jest.fn();
    const { getByLabelText } = render(
      <ListTitleHeader
        nombre="Compras hogar"
        pendientesCount={3}
        totalCount={5}
        codigoCompartir="ABC123"
        onDuplicate={onDuplicate}
      />
    );

    fireEvent.press(getByLabelText('Duplicar lista actual'));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });
});
