import { Router } from 'express';
import { notFound } from '../../lib/httpError';
import { parseId } from '../../lib/validation';
import { carInputSchema, createCar, deleteCar, updateCar } from '../../services/cars';

export const adminCarsRouter = Router();

adminCarsRouter.post('/', async (req, res) => {
  const input = carInputSchema.parse(req.body);
  res.status(201).json(await createCar(input));
});

adminCarsRouter.put('/:id', async (req, res) => {
  const input = carInputSchema.parse(req.body);
  const id = parseId(req.params.id);
  const car = id === null ? null : await updateCar(id, input);
  if (!car) throw notFound('Car not found.');
  res.json(car);
});

adminCarsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const deleted = id === null ? false : await deleteCar(id);
  if (!deleted) throw notFound('Car not found.');
  res.status(204).end();
});
