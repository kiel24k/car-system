import { Router } from 'express';
import { notFound } from '../lib/httpError';
import { parseId } from '../lib/validation';
import { carListQuerySchema, findCar, getCarFilters, listCars } from '../services/cars';

export const carsRouter = Router();

carsRouter.get('/', async (req, res) => {
  const query = carListQuerySchema.parse(req.query);
  res.json(await listCars(query));
});

carsRouter.get('/filters', async (_req, res) => {
  res.json(await getCarFilters());
});

carsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const car = id === null ? null : await findCar(id);
  if (!car) throw notFound('Car not found.');
  res.json(car);
});
