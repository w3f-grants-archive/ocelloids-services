import { FastifyInstance } from 'fastify';

import version from '../version.js';

export default async function Root(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        hide: true,
        response: { 200: { type: 'string' } },
      },
    },
    async (_, reply) => {
      reply.send(
        `Ocelloids Services Node v${version}\n` +
          // eslint-disable-next-line max-len
          "@@@@@@@^^~~~~~~~~~~~~~~~~~~~~^^@@@@@@@@\n@@@@@@^     ~^  @  @@ @ @ @ I  ~^@@@@@@\n@@@@@            ~ ~~ ~I          @@@@@\n@@@@'                  '  _,w@<    @@@@\n@@@@     @@@@@@@@w___,w@@@@@@@@  @  @@@\n@@@@     @@@@@@@@@@@@@@@@@@@@@@  I  @@@\n@@@@     @@@@@@@@@@@@@@@@@@@@*@[ i  @@@\n@@@@     @@@@@@@@@@@@@@@@@@@@[][ | ]@@@\n@@@@     ~_,,_ ~@@@@@@@~ ____~ @    @@@\n@@@@    _~ ,  ,  `@@@~  _  _`@ ]L  J@@@\n@@@@  , @@w@ww+   @@@ww``,,@w@ ][  @@@@\n@@@@,  @@@@www@@@ @@@@@@@ww@@@@@[  @@@@\n@@@@@_|| @@@@@@P' @@P@@@@@@@@@@@[|c@@@@\n@@@@@@w| '@@P~  P]@@@-~, ~Y@@^'],@@@@@@\n@@@@@@@[   _        _J@@Tk     ]]@@@@@@\n@@@@@@@@,@ @@, c,,,,,,,y ,w@@[ ,@@@@@@@\n@@@@@@@@@ i @w   ====--_@@@@@  @@@@@@@@\n@@@@@@@@@@`,P~ _ ~^^^^Y@@@@@  @@@@@@@@@\n@@@@^^=^@@^   ^' ,ww,w@@@@@ _@@@@@@@@@@\n@@@_xJ~ ~   ,    @@@@@@@P~_@@@@@@@@@@@@\n@@   @,   ,@@@,_____   _,J@@@@@@@@@@@@@\n@@L  `' ,@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
      );
    }
  );
}
