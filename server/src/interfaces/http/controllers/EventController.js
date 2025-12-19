const crypto = require('crypto');

class EventController {
  constructor(eventRepository) {
    this.eventRepository = eventRepository;
  }

  async listEvents(req, res) {
    try {
      const events = await this.eventRepository.findAll();
      // Sort by date descending
      events.sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json(events);
    } catch (error) {
      console.error('Error listing events:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createEvent(req, res) {
    try {
      const { title, description, date, location, workload, status } = req.body;

      if (!title || !date) {
        return res.status(400).json({ error: 'Title and Date are required' });
      }

      const newEvent = {
        id: crypto.randomUUID(),
        title,
        description: description || '',
        date,
        location: location || '',
        workload: workload || '',
        status: status || 'draft', // draft, open, closed, finished
        registrations: [], // List of registered users (could be moved to separate collection later)
        audit: {}
      };

      await this.eventRepository.save(newEvent);
      res.status(201).json(newEvent);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getEvent(req, res) {
    try {
      const { id } = req.params;
      const event = await this.eventRepository.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      console.error('Error getting event:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const event = await this.eventRepository.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const { title, description, date, location, workload, status } = req.body;

      if (title) event.title = title;
      if (description !== undefined) event.description = description;
      if (date) event.date = date;
      if (location !== undefined) event.location = location;
      if (workload !== undefined) event.workload = workload;
      if (status) event.status = status;

      await this.eventRepository.save(event);
      res.json(event);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const success = await this.eventRepository.delete(id);
      if (!success) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = EventController;
